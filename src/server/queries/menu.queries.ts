'use server';

import { prisma } from '@/lib/prisma';

export async function getMenuByCategory() {
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

export async function getAllMenuItems() {
    return prisma.menuItem.findMany({
        include: { category: true },
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
