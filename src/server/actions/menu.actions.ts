'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { menuItemSchema, type MenuItemInput } from '@/types';

export async function createMenuItem(input: MenuItemInput) {
    const result = menuItemSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }

    try {
        await prisma.menuItem.create({
            data: {
                name: result.data.name,
                description: result.data.description,
                basePrice: result.data.basePrice,
                categoryId: result.data.categoryId,
                isAvailable: result.data.isAvailable,
                imageUrl: result.data.imageUrl || null,
            },
        });

        revalidatePath('/(dashboard)/admin/menu', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to create menu item:', error);
        return { success: false, error: 'Failed to create menu item' };
    }
}

export async function updateMenuItem(id: string, input: MenuItemInput) {
    const result = menuItemSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }

    try {
        await prisma.menuItem.update({
            where: { id },
            data: {
                name: result.data.name,
                description: result.data.description,
                basePrice: result.data.basePrice,
                categoryId: result.data.categoryId,
                isAvailable: result.data.isAvailable,
                imageUrl: result.data.imageUrl || null,
            },
        });

        revalidatePath('/(dashboard)/admin/menu', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to update menu item:', error);
        return { success: false, error: 'Failed to update menu item' };
    }
}

export async function toggleMenuItemAvailability(id: string) {
    try {
        const item = await prisma.menuItem.findUnique({ where: { id } });
        if (!item) return { success: false, error: 'Item not found' };

        await prisma.menuItem.update({
            where: { id },
            data: { isAvailable: !item.isAvailable },
        });

        revalidatePath('/(dashboard)/admin/menu', 'page');
        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to toggle availability:', error);
        return { success: false, error: 'Failed to toggle availability' };
    }
}

export async function deleteMenuItem(id: string) {
    try {
        await prisma.menuItem.delete({ where: { id } });
        revalidatePath('/(dashboard)/admin/menu', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete menu item:', error);
        return { success: false, error: 'Failed to delete menu item' };
    }
}

export async function createCategory(name: string) {
    try {
        const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });
        await prisma.category.create({
            data: { name, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
        });
        revalidatePath('/(dashboard)/admin/menu', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to create category:', error);
        return { success: false, error: 'Failed to create category' };
    }
}
