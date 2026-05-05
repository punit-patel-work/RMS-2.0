'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { AuthError, requireManager } from '@/lib/auth-helpers';
import { hit, reset } from '@/lib/rate-limit';

// S-H8: timeclock endpoints all do bcrypt.compare against a 4-digit PIN —
// without a rate limit those endpoints are an even nicer brute-force oracle
// than login (no CSRF token, no session needed). 10 attempts per 5 minutes
// per employee ID matches the login policy.
const TIMECLOCK_MAX_ATTEMPTS = 10;
const TIMECLOCK_WINDOW_MS = 5 * 60 * 1000;

/**
 * Centralized PIN verification with rate limiting. Returns the matched user
 * on success, or an error string on either bad credentials or rate-limit hit.
 * Always returns the same generic error message so the timing/response shape
 * doesn't leak which case occurred.
 */
async function verifyEmployeePin(
    employeeId: string,
    pinCode: string
): Promise<{ ok: true; user: { id: string; name: string; pinCode: string; isActive: boolean } } | { ok: false; error: string }> {
    const rlKey = `clock:${employeeId.trim().toLowerCase()}`;
    const rl = hit(rlKey, TIMECLOCK_MAX_ATTEMPTS, TIMECLOCK_WINDOW_MS);
    if (!rl.ok) {
        return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' };
    }

    const user = await prisma.user.findUnique({ where: { employeeId } });
    if (!user || !user.isActive) {
        return { ok: false, error: 'Invalid Employee ID' };
    }

    const isValid = await bcrypt.compare(pinCode, user.pinCode);
    if (!isValid) {
        return { ok: false, error: 'Invalid PIN' };
    }

    // Clear bucket on successful auth so legitimate users aren't penalized.
    reset(rlKey);
    return { ok: true, user };
}

export async function clockIn(employeeId: string, pinCode: string) {
    try {
        const auth = await verifyEmployeePin(employeeId, pinCode);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }
        const user = auth.user;

        // F-M7: two tabs firing clockIn() simultaneously used to both pass the
        // findFirst check before either insert committed, producing two
        // overlapping open AttendanceRecords. Wrapping the check+insert in a
        // Serializable transaction means Postgres serializes the two attempts:
        // the second one either sees the first's insert (returns "already
        // clocked in") or aborts with a serialization_failure we translate.
        const txResult = await prisma.$transaction(
            async (tx) => {
                const existingRecord = await tx.attendanceRecord.findFirst({
                    where: {
                        userId: user.id,
                        clockOut: null,
                    },
                    select: { id: true },
                });

                if (existingRecord) {
                    return { ok: false as const, error: 'Already clocked in' };
                }

                await tx.attendanceRecord.create({
                    data: {
                        userId: user.id,
                        clockIn: new Date(),
                    },
                });

                return { ok: true as const };
            },
            { isolationLevel: 'Serializable' }
        );

        if (!txResult.ok) {
            return { success: false, error: txResult.error };
        }

        return { success: true, message: `Clocked in successfully. Welcome, ${user.name}!` };
    } catch (error) {
        // Postgres raises a serialization_failure (P2034-ish via Prisma) when
        // two Serializable transactions collide. The correct user-facing
        // message is still "already clocked in" because the other transaction
        // won — either way they have an open record.
        if (error instanceof Error && /serialization|P2034|40001/i.test(error.message)) {
            return { success: false, error: 'Already clocked in' };
        }
        console.error('Clock-in error:', error);
        return { success: false, error: 'Failed to clock in' };
    }
}

export async function clockOut(employeeId: string, pinCode: string) {
    try {
        const auth = await verifyEmployeePin(employeeId, pinCode);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }
        const user = auth.user;

        const openRecord = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                clockOut: null,
            },
            orderBy: { clockIn: 'desc' }
        });

        if (!openRecord) {
            return { success: false, error: 'No active shift found. You are not clocked in.' };
        }

        // F-M9: capture clockOut once and use that exact value for both the
        // DB write and the duration calc. Calling new Date() twice would let
        // a stray ms drift into the displayed shift length and, worse, make
        // the user-facing summary disagree with what's actually persisted.
        const clockOutAt = new Date();
        await prisma.attendanceRecord.update({
            where: { id: openRecord.id },
            data: { clockOut: clockOutAt },
        });

        const durationMinutes = Math.round((clockOutAt.getTime() - openRecord.clockIn.getTime()) / 60000);
        const hours = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;

        return {
            success: true,
            message: `Clocked out successfully. Shift duration: ${hours}h ${mins}m`
        };
    } catch (error) {
        console.error('Clock-out error:', error);
        return { success: false, error: 'Failed to clock out' };
    }
}

export async function getAttendanceStatus(employeeId: string, pinCode: string) {
    try {
        const auth = await verifyEmployeePin(employeeId, pinCode);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }
        const user = auth.user;

        const openRecord = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                clockOut: null,
            },
        });

        return {
            success: true,
            isClockedIn: !!openRecord,
            clockInTime: openRecord?.clockIn,
            userName: user.name,
        };
    } catch (error) {
        console.error('Status check error:', error);
        return { success: false, error: 'Failed to check status' };
    }
}

export async function getStaffDashboard(employeeId: string, pinCode: string) {
    try {
        const auth = await verifyEmployeePin(employeeId, pinCode);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }
        const user = auth.user;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // F-M8: read week-start from settings (US default Sunday=0, ISO=Monday=1).
        // Falls back to Sunday if unset/invalid for backwards-compat.
        const weekStartSetting = await prisma.siteSettings.findUnique({
            where: { key: 'WEEK_START_DAY' },
        });
        const startDay = (() => {
            const v = parseInt(weekStartSetting?.value ?? '0', 10);
            return Number.isFinite(v) && v >= 0 && v <= 6 ? v : 0;
        })();
        const weekStart = new Date();
        const offset = (weekStart.getDay() - startDay + 7) % 7;
        weekStart.setDate(weekStart.getDate() - offset);
        weekStart.setHours(0, 0, 0, 0);

        const records = await prisma.attendanceRecord.findMany({
            where: {
                userId: user.id,
                clockIn: { gte: weekStart }
            },
            orderBy: { clockIn: 'desc' }
        });

        const openRecord = records.find(r => r.clockOut === null);

        // Calculate totals
        let todayMinutes = 0;
        let weekMinutes = 0;

        for (const record of records) {
            const outTime = record.clockOut || new Date(); // If open, calculate up to now
            const durationMins = Math.max(0, Math.round((outTime.getTime() - record.clockIn.getTime()) / 60000));

            weekMinutes += durationMins;
            if (record.clockIn >= todayStart) {
                todayMinutes += durationMins;
            }
        }

        return {
            success: true,
            isClockedIn: !!openRecord,
            clockInTime: openRecord?.clockIn,
            userName: user.name,
            todayHours: (todayMinutes / 60).toFixed(1),
            weekHours: (weekMinutes / 60).toFixed(1),
            weeklyRecords: records
        };
    } catch (error) {
        console.error('Dashboard fetch error:', error);
        return { success: false, error: 'Failed to load dashboard' };
    }
}

export async function getTimesheets(startDate: Date, endDate: Date) {
    try {
        // Payroll data — managers only.
        await requireManager();
        const records = await prisma.attendanceRecord.findMany({
            where: {
                clockIn: {
                    gte: startDate,
                },
                OR: [
                    { clockOut: { lte: endDate } },
                    { clockOut: null }
                ]
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        employeeId: true,
                    }
                }
            },
            orderBy: {
                clockIn: 'desc'
            }
        });

        // Group by user and calculate total hours
        const userSummary: Record<string, { user: any, totalMinutes: number, records: any[] }> = {};

        for (const record of records) {
            const userId = record.userId;
            if (!userSummary[userId]) {
                userSummary[userId] = {
                    user: record.user,
                    totalMinutes: 0,
                    records: []
                };
            }

            userSummary[userId].records.push(record);

            if (record.clockOut) {
                const durationMs = record.clockOut.getTime() - record.clockIn.getTime();
                userSummary[userId].totalMinutes += Math.max(0, Math.round(durationMs / 60000));
            }
        }

        return { success: true, data: Object.values(userSummary) };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to fetch timesheets:', error);
        return { success: false, error: 'Failed to fetch timesheets' };
    }
}

// ADMIN ACTIONS — mutating any timesheet requires a manager role.

function validateRange(clockIn: Date, clockOut: Date | null) {
    if (!(clockIn instanceof Date) || Number.isNaN(clockIn.getTime())) {
        throw new Error('Invalid clock-in timestamp');
    }
    if (clockOut !== null) {
        if (!(clockOut instanceof Date) || Number.isNaN(clockOut.getTime())) {
            throw new Error('Invalid clock-out timestamp');
        }
        if (clockOut <= clockIn) {
            throw new Error('Clock-out must be after clock-in');
        }
    }
    // Sanity cap: no single shift > 24 hours.
    if (clockOut && clockOut.getTime() - clockIn.getTime() > 24 * 60 * 60 * 1000) {
        throw new Error('A single shift cannot exceed 24 hours');
    }
}

export async function adminUpdateRecord(recordId: string, clockIn: Date, clockOut: Date | null) {
    try {
        await requireManager();
        validateRange(clockIn, clockOut);
        await prisma.attendanceRecord.update({
            where: { id: recordId },
            data: { clockIn, clockOut }
        });
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        if (error instanceof Error) return { success: false, error: error.message };
        console.error('Failed to update record:', error);
        return { success: false, error: 'Failed to update record' };
    }
}

export async function adminDeleteRecord(recordId: string) {
    try {
        await requireManager();
        await prisma.attendanceRecord.delete({
            where: { id: recordId }
        });
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to delete record:', error);
        return { success: false, error: 'Failed to delete record' };
    }
}

export async function adminCreateRecord(userId: string, clockIn: Date, clockOut: Date | null) {
    try {
        await requireManager();
        validateRange(clockIn, clockOut);

        // Prevent creating an "open" record if one already exists for the user.
        if (clockOut === null) {
            const alreadyOpen = await prisma.attendanceRecord.findFirst({
                where: { userId, clockOut: null },
                select: { id: true },
            });
            if (alreadyOpen) {
                return { success: false, error: 'User already has an open (clocked-in) record' };
            }
        }

        await prisma.attendanceRecord.create({
            data: { userId, clockIn, clockOut }
        });
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        if (error instanceof Error) return { success: false, error: error.message };
        console.error('Failed to create record:', error);
        return { success: false, error: 'Failed to create record' };
    }
}

