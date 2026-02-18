'use server';

import { prisma } from '@/lib/prisma';

export async function getAllUsers() {
    return prisma.user.findMany({
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: { select: { orders: true } },
        },
    });
}
