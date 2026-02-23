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
                trackStock: result.data.trackStock,
                stockQuantity: result.data.stockQuantity,
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
        const itemObj = await prisma.menuItem.findUnique({ where: { id } });
        let isAvailable = result.data.isAvailable;
        if (itemObj?.trackStock && itemObj.stockQuantity <= 0 && result.data.stockQuantity > 0 && !result.data.isAvailable) {
            isAvailable = true;
        }

        await prisma.menuItem.update({
            where: { id },
            data: {
                name: result.data.name,
                description: result.data.description,
                basePrice: result.data.basePrice,
                categoryId: result.data.categoryId,
                isAvailable: isAvailable,
                trackStock: result.data.trackStock,
                stockQuantity: result.data.stockQuantity,
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

export async function createCategory(name: string, stationId?: string) {
    try {
        const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });
        await prisma.category.create({
            data: {
                name,
                sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
                stationId: stationId || null,
            },
        });
        revalidatePath('/(dashboard)/admin/menu', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to create category:', error);
        return { success: false, error: 'Failed to create category' };
    }
}

export async function updateCategory(id: string, name: string, stationId?: string) {
    try {
        await prisma.category.update({
            where: { id },
            data: {
                name,
                stationId: stationId || null,
            },
        });
        revalidatePath('/(dashboard)/admin/menu', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to update category:', error);
        return { success: false, error: 'Failed to update category' };
    }
}

export async function updateItemModifiers(menuItemId: string, groups: any[]) { // Using any[] to bypass strict zod typing internally if needed, or import ModifierGroupInput
    try {
        const existingItem = await prisma.menuItem.findUnique({
            where: { id: menuItemId },
            include: { modifierGroups: true }
        });

        if (existingItem) {
            await prisma.menuItem.update({
                where: { id: menuItemId },
                data: {
                    modifierGroups: {
                        disconnect: existingItem.modifierGroups.map(g => ({ id: g.id }))
                    }
                }
            });
        }

        const groupIds = [];
        for (const group of groups) {
            if (group.id) {
                await prisma.modifierGroup.update({
                    where: { id: group.id },
                    data: {
                        name: group.name,
                        isRequired: group.isRequired,
                        maxChoices: group.maxChoices,
                        modifiers: {
                            deleteMany: {}, // Clear old modifiers to replace
                            create: group.modifiers.map((m: any) => ({
                                name: m.name,
                                priceAdjustment: m.priceAdjustment
                            }))
                        }
                    }
                });
                groupIds.push({ id: group.id });
            } else {
                const newGroup = await prisma.modifierGroup.create({
                    data: {
                        name: group.name,
                        isRequired: group.isRequired,
                        maxChoices: group.maxChoices,
                        modifiers: {
                            create: group.modifiers.map((m: any) => ({
                                name: m.name,
                                priceAdjustment: m.priceAdjustment
                            }))
                        }
                    }
                });
                groupIds.push({ id: newGroup.id });
            }
        }

        await prisma.menuItem.update({
            where: { id: menuItemId },
            data: {
                modifierGroups: {
                    connect: groupIds
                }
            }
        });

        revalidatePath('/(dashboard)/admin/menu', 'page');
        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to update modifiers:', error);
        return { success: false, error: 'Failed to update modifiers' };
    }
}
