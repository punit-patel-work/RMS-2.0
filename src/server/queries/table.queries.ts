'use server';

import { prisma } from '@/lib/prisma';

export async function getAllTables() {
    const now = new Date();
    return prisma.table.findMany({
        include: {
            currentOrder: {
                include: {
                    items: true,
                },
            },
            mergedFrom: {
                select: { id: true, name: true },
            },
            reservations: {
                where: {
                    status: 'ACTIVE',
                    reservedUntil: { gte: now }, // Only future/current reservations
                },
                orderBy: { reservedAt: 'asc' },
                select: {
                    id: true,
                    guestName: true,
                    reservedAt: true,
                    reservedUntil: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    });
}

export async function getTableById(id: string) {
    return prisma.table.findUnique({
        where: { id },
        include: {
            currentOrder: {
                include: {
                    items: {
                        include: { menuItem: true },
                    },
                },
            },
        },
    });
}
