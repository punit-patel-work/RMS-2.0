'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { TableStatus } from '@/generated/prisma/client';
import { auth } from '@/lib/auth';

export async function updateTableStatus(
    tableId: string,
    status: TableStatus
) {
    try {
        await prisma.table.update({
            where: { id: tableId },
            data: { status },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to update table:', error);
        return { success: false, error: 'Failed to update table status' };
    }
}

export async function createTable(name: string, seats: number, shape: string = 'SQUARE') {
    try {
        await prisma.table.create({
            data: {
                name,
                seats,
                shape,
                width: shape === 'ROUND' ? 80 : 100,
                height: shape === 'ROUND' ? 80 : 100,
            },
        });

        revalidatePath('/(dashboard)/admin/tables', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to create table:', error);
        return { success: false, error: 'Failed to create table' };
    }
}

export async function updateTableLayout(tableId: string, data: { positionX?: number, positionY?: number, width?: number, height?: number, shape?: string }) {
    try {
        await prisma.table.update({
            where: { id: tableId },
            data,
        });

        revalidatePath('/(dashboard)/admin/tables', 'page');
        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to update table layout:', error);
        return { success: false, error: 'Failed to update table layout' };
    }
}

export async function deleteTable(tableId: string) {
    try {
        await prisma.table.delete({
            where: { id: tableId },
        });

        revalidatePath('/(dashboard)/admin/tables', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete table:', error);
        return { success: false, error: 'Failed to delete table' };
    }
}

// ─── Reserve Table (creates a Reservation record) ────────────

export async function reserveTable(params: {
    tableId: string;
    guestName: string;
    reservedAt: Date;
    reservedUntil: Date;
}) {
    try {
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return { success: false, error: 'Unauthorized: User ID missing' };
        }

        const table = await prisma.table.findUnique({
            where: { id: params.tableId },
        });
        if (!table) return { success: false, error: 'Table not found' };

        // Check for overlapping ACTIVE reservations on same table
        const conflict = await prisma.reservation.findFirst({
            where: {
                tableId: params.tableId,
                status: 'ACTIVE',
                reservedAt: { lt: params.reservedUntil },
                reservedUntil: { gt: params.reservedAt },
            },
        });
        if (conflict) {
            const startStr = conflict.reservedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endStr = conflict.reservedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return {
                success: false,
                error: `Conflicts with "${conflict.guestName}" reservation (${startStr}–${endStr})`,
            };
        }

        // Create reservation record — table status does NOT change
        await prisma.reservation.create({
            data: {
                tableId: params.tableId,
                createdById: userId,
                guestName: params.guestName,
                reservedAt: params.reservedAt,
                reservedUntil: params.reservedUntil,
            },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to reserve table:', error);
        return { success: false, error: 'Failed to reserve table' };
    }
}

export async function cancelReservation(reservationId: string) {
    try {
        await prisma.reservation.update({
            where: { id: reservationId },
            data: { status: 'CANCELLED' },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to cancel reservation:', error);
        return { success: false, error: 'Failed to cancel reservation' };
    }
}

// ─── Merge Tables ────────────────────────────────────────────

export async function mergeTables(parentId: string, childIds: string[]) {
    try {
        const parent = await prisma.table.findUnique({ where: { id: parentId } });
        if (!parent) return { success: false, error: 'Parent table not found' };

        for (const childId of childIds) {
            const child = await prisma.table.findUnique({ where: { id: childId } });
            if (!child) continue;
            if (child.status === 'OCCUPIED') {
                return { success: false, error: `Cannot merge ${child.name} — it has an active order` };
            }

            await prisma.table.update({
                where: { id: childId },
                data: {
                    mergedIntoId: parentId,
                    status: 'OCCUPIED',
                },
            });
        }

        const children = await prisma.table.findMany({
            where: { mergedIntoId: parentId },
        });
        const totalSeats = parent.seats + children.reduce((s, c) => s + c.seats, 0);

        await prisma.table.update({
            where: { id: parentId },
            data: { seats: totalSeats },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to merge tables:', error);
        return { success: false, error: 'Failed to merge tables' };
    }
}

export async function demergeTables(parentId: string) {
    try {
        const children = await prisma.table.findMany({
            where: { mergedIntoId: parentId },
        });

        const parent = await prisma.table.findUnique({ where: { id: parentId } });
        if (!parent) return { success: false, error: 'Parent table not found' };

        for (const child of children) {
            await prisma.table.update({
                where: { id: child.id },
                data: {
                    mergedIntoId: null,
                    status: 'VACANT',
                },
            });
        }

        const originalSeats = parent.seats - children.reduce((s, c) => s + c.seats, 0);
        await prisma.table.update({
            where: { id: parentId },
            data: { seats: Math.max(originalSeats, 1) },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to demerge tables:', error);
        return { success: false, error: 'Failed to demerge tables' };
    }
}
