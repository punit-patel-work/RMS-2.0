'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { Role } from '@/generated/prisma/client';
import { AuthError, requireManager, requireSession } from '@/lib/auth-helpers';

async function assertNoOverlap(userId: string, startTime: Date, endTime: Date, excludeShiftId?: string) {
    if (!(startTime instanceof Date) || !(endTime instanceof Date) || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        throw new Error('Invalid shift dates');
    }
    if (endTime <= startTime) {
        throw new Error('Shift end must be after start');
    }
    const overlap = await prisma.schedule.findFirst({
        where: {
            userId,
            ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
            startTime: { lt: endTime },
            endTime: { gt: startTime },
        },
        select: { id: true },
    });
    if (overlap) {
        throw new Error('This user already has a shift that overlaps this time range');
    }
}

export async function createShift(data: {
    userId: string;
    startTime: Date;
    endTime: Date;
    role?: Role;
    notes?: string;
    isOnLeave?: boolean;
}) {
    try {
        await requireManager();
        await assertNoOverlap(data.userId, data.startTime, data.endTime);

        await prisma.schedule.create({
            data: {
                userId: data.userId,
                startTime: data.startTime,
                endTime: data.endTime,
                role: data.role,
                notes: data.notes,
                isOnLeave: data.isOnLeave || false,
            },
        });
        revalidatePath('/(dashboard)/schedule', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        if (error instanceof Error) return { success: false, error: error.message };
        console.error('Failed to create shift:', error);
        return { success: false, error: 'Failed to create shift' };
    }
}

export async function updateShift(shiftId: string, data: {
    startTime?: Date;
    endTime?: Date;
    role?: Role;
    notes?: string;
    isOnLeave?: boolean;
}) {
    try {
        await requireManager();

        const existing = await prisma.schedule.findUnique({ where: { id: shiftId } });
        if (!existing) return { success: false, error: 'Shift not found' };

        const nextStart = data.startTime ?? existing.startTime;
        const nextEnd = data.endTime ?? existing.endTime;
        await assertNoOverlap(existing.userId, nextStart, nextEnd, shiftId);

        await prisma.schedule.update({
            where: { id: shiftId },
            data,
        });
        revalidatePath('/(dashboard)/schedule', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        if (error instanceof Error) return { success: false, error: error.message };
        console.error('Failed to update shift:', error);
        return { success: false, error: 'Failed to update shift' };
    }
}

export async function deleteShift(shiftId: string) {
    try {
        await requireManager();
        await prisma.schedule.delete({
            where: { id: shiftId },
        });
        revalidatePath('/(dashboard)/schedule', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to delete shift:', error);
        return { success: false, error: 'Failed to delete shift' };
    }
}

export async function getWeeklySchedules(startDate: Date, endDate: Date) {
    try {
        const session = await requireSession();
        const isManager = session.user.role === 'OWNER' || session.user.role === 'SUPERVISOR';

        const schedules = await prisma.schedule.findMany({
            where: {
                // Non-managers may only see their own schedule.
                ...(isManager ? {} : { userId: session.user.id }),
                startTime: { gte: startDate },
                endTime: { lte: endDate },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
            orderBy: {
                startTime: 'asc',
            },
        });
        return { success: true, data: schedules };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to fetch schedules:', error);
        return { success: false, error: 'Failed to fetch schedules' };
    }
}

export async function getStaffList() {
    try {
        // Staff roster is manager-only info.
        await requireManager();
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, role: true },
        });
        return { success: true, data: users };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to fetch staff list:', error);
        return { success: false, error: 'Failed to fetch staff list' };
    }
}

export async function copyPreviousWeekSchedule(currentWeekStart: Date) {
    try {
        await requireManager();

        const d = new Date(currentWeekStart);
        d.setHours(0, 0, 0, 0);

        const prevWeekStart = new Date(d);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);

        const prevWeekEnd = new Date(prevWeekStart);
        prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
        prevWeekEnd.setHours(23, 59, 59, 999);

        const currentWeekEnd = new Date(d);
        currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
        currentWeekEnd.setHours(23, 59, 59, 999);

        // Idempotency guard — don't clone on top of an already-populated week.
        const existingInCurrentWeek = await prisma.schedule.count({
            where: {
                startTime: { gte: d, lte: currentWeekEnd },
            },
        });
        if (existingInCurrentWeek > 0) {
            return {
                success: false,
                error: `Target week already has ${existingInCurrentWeek} shift(s). Delete them before copying.`,
            };
        }

        const prevShifts = await prisma.schedule.findMany({
            where: {
                startTime: {
                    gte: prevWeekStart,
                    lte: prevWeekEnd,
                },
            },
        });

        if (prevShifts.length === 0) {
            return { success: false, error: 'No shifts found in the previous week to copy.' };
        }

        const newShiftsData = prevShifts.map((shift) => {
            const newStart = new Date(shift.startTime);
            newStart.setDate(newStart.getDate() + 7);

            const newEnd = new Date(shift.endTime);
            newEnd.setDate(newEnd.getDate() + 7);

            return {
                userId: shift.userId,
                startTime: newStart,
                endTime: newEnd,
                role: shift.role,
                notes: shift.notes,
                isOnLeave: shift.isOnLeave,
            };
        });

        await prisma.schedule.createMany({
            data: newShiftsData,
        });

        revalidatePath('/(dashboard)/schedule', 'page');
        return { success: true, message: `Successfully copied ${newShiftsData.length} shifts.` };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to copy schedule:', error);
        return { success: false, error: 'Failed to copy previous week schedule' };
    }
}
