'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function clockIn(employeeId: string, pinCode: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { employeeId },
        });

        if (!user || !user.isActive) {
            return { success: false, error: 'Invalid Employee ID' };
        }

        const isValid = await bcrypt.compare(pinCode, user.pinCode);
        if (!isValid) {
            return { success: false, error: 'Invalid PIN' };
        }

        // Check if already clocked in
        const existingRecord = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                clockOut: null,
            },
        });

        if (existingRecord) {
            return { success: false, error: 'Already clocked in' };
        }

        await prisma.attendanceRecord.create({
            data: {
                userId: user.id,
                clockIn: new Date(),
            },
        });

        return { success: true, message: `Clocked in successfully. Welcome, ${user.name}!` };
    } catch (error) {
        console.error('Clock-in error:', error);
        return { success: false, error: 'Failed to clock in' };
    }
}

export async function clockOut(employeeId: string, pinCode: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { employeeId },
        });

        if (!user || !user.isActive) {
            return { success: false, error: 'Invalid Employee ID' };
        }

        const isValid = await bcrypt.compare(pinCode, user.pinCode);
        if (!isValid) {
            return { success: false, error: 'Invalid PIN' };
        }

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

        await prisma.attendanceRecord.update({
            where: { id: openRecord.id },
            data: { clockOut: new Date() },
        });

        const durationMinutes = Math.round((new Date().getTime() - openRecord.clockIn.getTime()) / 60000);
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
        const user = await prisma.user.findUnique({
            where: { employeeId },
        });

        if (!user || !user.isActive) {
            return { success: false, error: 'Invalid Employee ID' };
        }

        const isValid = await bcrypt.compare(pinCode, user.pinCode);
        if (!isValid) {
            return { success: false, error: 'Invalid PIN' };
        }

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
        const user = await prisma.user.findUnique({
            where: { employeeId },
        });

        if (!user || !user.isActive) {
            return { success: false, error: 'Invalid Employee ID' };
        }

        const isValid = await bcrypt.compare(pinCode, user.pinCode);
        if (!isValid) {
            return { success: false, error: 'Invalid PIN' };
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
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
        console.error('Failed to fetch timesheets:', error);
        return { success: false, error: 'Failed to fetch timesheets' };
    }
}

// ADMIN ACTIONS

export async function adminUpdateRecord(recordId: string, clockIn: Date, clockOut: Date | null) {
    try {
        await prisma.attendanceRecord.update({
            where: { id: recordId },
            data: { clockIn, clockOut }
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to update record:', error);
        return { success: false, error: 'Failed to update record' };
    }
}

export async function adminDeleteRecord(recordId: string) {
    try {
        await prisma.attendanceRecord.delete({
            where: { id: recordId }
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to delete record:', error);
        return { success: false, error: 'Failed to delete record' };
    }
}

export async function adminCreateRecord(userId: string, clockIn: Date, clockOut: Date | null) {
    try {
        await prisma.attendanceRecord.create({
            data: { userId, clockIn, clockOut }
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to create record:', error);
        return { success: false, error: 'Failed to create record' };
    }
}
