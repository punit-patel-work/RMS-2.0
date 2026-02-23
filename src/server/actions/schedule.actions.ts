'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { Role } from '@/generated/prisma/client';

export async function createShift(data: {
    userId: string;
    startTime: Date;
    endTime: Date;
    role?: Role;
    notes?: string;
    isOnLeave?: boolean;
}) {
    try {
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
        await prisma.schedule.update({
            where: { id: shiftId },
            data,
        });
        revalidatePath('/(dashboard)/schedule', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to update shift:', error);
        return { success: false, error: 'Failed to update shift' };
    }
}

export async function deleteShift(shiftId: string) {
    try {
        await prisma.schedule.delete({
            where: { id: shiftId },
        });
        revalidatePath('/(dashboard)/schedule', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete shift:', error);
        return { success: false, error: 'Failed to delete shift' };
    }
}

export async function getWeeklySchedules(startDate: Date, endDate: Date) {
    try {
        const schedules = await prisma.schedule.findMany({
            where: {
                startTime: {
                    gte: startDate,
                },
                endTime: {
                    lte: endDate,
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });
        return { success: true, data: schedules };
    } catch (error) {
        console.error('Failed to fetch schedules:', error);
        return { success: false, error: 'Failed to fetch schedules' };
    }
}

export async function getStaffList() {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, role: true }
        });
        return { success: true, data: users };
    } catch (error) {
        console.error('Failed to fetch staff list:', error);
        return { success: false, error: 'Failed to fetch staff list' };
    }
}

export async function copyPreviousWeekSchedule(currentWeekStart: Date) {
    try {
        const d = new Date(currentWeekStart);
        // Ensure starting at 00:00:00 local time
        d.setHours(0, 0, 0, 0);

        // Find previous week's boundary
        const prevWeekStart = new Date(d);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);

        const prevWeekEnd = new Date(prevWeekStart);
        prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
        prevWeekEnd.setHours(23, 59, 59, 999);

        // Fetch all shifts from the previous week
        const prevShifts = await prisma.schedule.findMany({
            where: {
                startTime: {
                    gte: prevWeekStart,
                    lte: prevWeekEnd,
                }
            }
        });

        if (prevShifts.length === 0) {
            return { success: false, error: 'No shifts found in the previous week to copy.' };
        }

        // Clone them, adding 7 days to startTime and endTime
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
            data: newShiftsData
        });

        revalidatePath('/(dashboard)/schedule', 'page');
        return { success: true, message: `Successfully copied ${newShiftsData.length} shifts.` };
    } catch (error) {
        console.error('Failed to copy schedule:', error);
        return { success: false, error: 'Failed to copy previous week schedule' };
    }
}
