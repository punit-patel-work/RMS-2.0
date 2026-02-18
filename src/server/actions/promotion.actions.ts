'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { promotionSchema, type PromotionInput } from '@/types';

export async function createPromotion(input: PromotionInput) {
    const result = promotionSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }

    try {
        await prisma.promotion.create({
            data: {
                name: result.data.name,
                type: result.data.type,
                value: result.data.value,
                scope: result.data.type === 'COMBO' ? 'ITEM' : result.data.scope, // Default to ITEM for combos
                menuItemId: result.data.type === 'COMBO' ? null : (result.data.scope === 'ITEM' ? result.data.menuItemId : null),
                categoryId: result.data.type === 'COMBO' ? null : (result.data.scope === 'CATEGORY' ? result.data.categoryId : null),
                startsAt: result.data.startsAt ? new Date(result.data.startsAt) : null,
                endsAt: result.data.endsAt ? new Date(result.data.endsAt) : null,
                rules: result.data.rules ? {
                    create: result.data.rules.map(r => ({
                        requiredQuantity: r.requiredQuantity,
                        menuItem: r.menuItemId ? { connect: { id: r.menuItemId } } : undefined,
                        category: r.categoryId ? { connect: { id: r.categoryId } } : undefined,
                        isDiscounted: r.isDiscounted,
                        name: r.name
                    }))
                } : undefined
            },
        });

        revalidatePath('/(dashboard)/admin/promotions', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to create promotion:', error);
        return { success: false, error: 'Failed to create promotion' };
    }
}

export async function updatePromotion(id: string, input: PromotionInput) {
    const result = promotionSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }

    try {
        // If updating rules, we replace them
        const rulesUpdate = result.data.rules ? {
            deleteMany: {},
            create: result.data.rules.map(r => ({
                requiredQuantity: r.requiredQuantity,
                menuItem: r.menuItemId ? { connect: { id: r.menuItemId } } : undefined,
                category: r.categoryId ? { connect: { id: r.categoryId } } : undefined,
                isDiscounted: r.isDiscounted,
                name: r.name
            }))
        } : undefined;

        await prisma.promotion.update({
            where: { id },
            data: {
                name: result.data.name,
                type: result.data.type,
                value: result.data.value,
                scope: result.data.type === 'COMBO' ? 'ITEM' : result.data.scope,
                menuItemId: result.data.type === 'COMBO' ? null : (result.data.scope === 'ITEM' ? result.data.menuItemId : null),
                categoryId: result.data.type === 'COMBO' ? null : (result.data.scope === 'CATEGORY' ? result.data.categoryId : null),
                startsAt: result.data.startsAt ? new Date(result.data.startsAt) : null,
                endsAt: result.data.endsAt ? new Date(result.data.endsAt) : null,
                rules: rulesUpdate
            },
        });

        revalidatePath('/(dashboard)/admin/promotions', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to update promotion:', error);
        return { success: false, error: 'Failed to update promotion' };
    }
}

export async function togglePromotion(id: string) {
    try {
        const promo = await prisma.promotion.findUnique({ where: { id } });
        if (!promo) return { success: false, error: 'Promotion not found' };

        await prisma.promotion.update({
            where: { id },
            data: { active: !promo.active },
        });

        revalidatePath('/(dashboard)/admin/promotions', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to toggle promotion:', error);
        return { success: false, error: 'Failed to toggle promotion' };
    }
}

export async function deletePromotion(id: string) {
    try {
        await prisma.promotion.delete({ where: { id } });
        revalidatePath('/(dashboard)/admin/promotions', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete promotion:', error);
        return { success: false, error: 'Failed to delete promotion' };
    }
}
