'use server';

import { prisma } from '@/lib/prisma';

export async function getMenuByCategory() {
    return prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            items: {
                where: { isAvailable: true },
                orderBy: { name: 'asc' },
                include: {
                    modifierGroups: {
                        include: { modifiers: true },
                        orderBy: { name: 'asc' }
                    }
                }
            },
        },
    });
}

export async function getAllMenuItems() {
    return prisma.menuItem.findMany({
        include: {
            category: true,
            modifierGroups: {
                include: { modifiers: true },
                orderBy: { name: 'asc' }
            }
        },
        orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
}

export async function getAllCategories() {
    return prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            items: {
                where: { isAvailable: true },
                orderBy: { name: 'asc' },
            },
        },
    });
}

export async function getAllStations() {
    return prisma.station.findMany({
        orderBy: { name: 'asc' },
    });
}
