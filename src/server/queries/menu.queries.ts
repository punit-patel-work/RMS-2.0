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

/**
 * P-C4: list-only variant for admin index pages that just render rows of
 * (name | category | price | stock | toggle). Skips the modifier eager-load,
 * which on a 60-item menu cuts the payload roughly in half.
 */
export async function getAllMenuItemsList() {
    return prisma.menuItem.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            basePrice: true,
            isAvailable: true,
            trackStock: true,
            stockQuantity: true,
            imageUrl: true,
            categoryId: true,
            category: { select: { id: true, name: true, sortOrder: true } },
            _count: { select: { modifierGroups: true } },
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
