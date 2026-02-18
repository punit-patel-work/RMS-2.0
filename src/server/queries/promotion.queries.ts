'use server';

import { prisma } from '@/lib/prisma';

export async function getActivePromotions() {
    const now = new Date();

    return prisma.promotion.findMany({
        where: {
            active: true,
            OR: [
                { startsAt: null },
                { startsAt: { lte: now } },
            ],
            AND: [
                {
                    OR: [
                        { endsAt: null },
                        { endsAt: { gte: now } },
                    ],
                },
            ],
        },
        include: {
            rules: {
                include: {
                    menuItem: true,
                    category: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}

export async function getAllPromotions() {
    return prisma.promotion.findMany({
        include: {
            rules: {
                include: {
                    menuItem: true,
                    category: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}
