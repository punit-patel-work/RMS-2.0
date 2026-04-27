'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { promotionSchema, type PromotionInput } from '@/types';
import { AuthError, requireManager } from '@/lib/auth-helpers';

// Sanity caps on promo value to prevent negative-price / fraud scenarios.
const MAX_PERCENT_VALUE = 100;
const MAX_FIXED_VALUE = 10_000; // $10k absolute cap on a single promo value

function validatePromoValue(type: string, value: number): string | null {
    if (!Number.isFinite(value) || value <= 0) {
        return 'Promotion value must be greater than zero';
    }
    if (type === 'PERCENT' && value > MAX_PERCENT_VALUE) {
        return `Percent promotion value cannot exceed ${MAX_PERCENT_VALUE}`;
    }
    if ((type === 'FIXED' || type === 'COMBO') && value > MAX_FIXED_VALUE) {
        return `Fixed/combo value cannot exceed ${MAX_FIXED_VALUE}`;
    }
    return null;
}

export async function createPromotion(input: PromotionInput) {
    try {
        await requireManager();
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        throw error;
    }

    const result = promotionSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }

    const valueErr = validatePromoValue(result.data.type, result.data.value);
    if (valueErr) return { success: false, error: valueErr };

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
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to create promotion:', error);
        return { success: false, error: 'Failed to create promotion' };
    }
}

export async function updatePromotion(id: string, input: PromotionInput) {
    try {
        await requireManager();
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        throw error;
    }

    const result = promotionSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }

    const valueErr = validatePromoValue(result.data.type, result.data.value);
    if (valueErr) return { success: false, error: valueErr };

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
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to update promotion:', error);
        return { success: false, error: 'Failed to update promotion' };
    }
}

export async function togglePromotion(id: string) {
    try {
        await requireManager();
        const promo = await prisma.promotion.findUnique({ where: { id } });
        if (!promo) return { success: false, error: 'Promotion not found' };

        await prisma.promotion.update({
            where: { id },
            data: { active: !promo.active },
        });

        revalidatePath('/(dashboard)/admin/promotions', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to toggle promotion:', error);
        return { success: false, error: 'Failed to toggle promotion' };
    }
}

export async function deletePromotion(id: string) {
    try {
        await requireManager();
        await prisma.promotion.delete({ where: { id } });
        revalidatePath('/(dashboard)/admin/promotions', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to delete promotion:', error);
        return { success: false, error: 'Failed to delete promotion' };
    }
}
