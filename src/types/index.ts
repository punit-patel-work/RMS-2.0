import { z } from 'zod';

// ─── Zod Schemas for Server Action Inputs ────────────────────

export const createOrderSchema = z.object({
    tableId: z.string().min(1, 'Table ID is required'),
    userId: z.string().min(1, 'User ID is required'),
    items: z
        .array(
            z.object({
                menuItemId: z.string(),
                quantity: z.number().int().positive(),
                notes: z.string().optional(),
            })
        )
        .min(1, 'Order must have at least one item'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const loginSchema = z.object({
    pinCode: z
        .string()
        .min(4, 'PIN must be at least 4 digits')
        .max(6, 'PIN must be at most 6 digits')
        .regex(/^\d+$/, 'PIN must contain only digits'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const menuItemSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    basePrice: z.number().positive('Price must be positive'),
    categoryId: z.string().min(1, 'Category is required'),
    isAvailable: z.boolean().default(true),
    imageUrl: z.string().url().optional().or(z.literal('')),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const promotionSchema = z.object({
    name: z.string().min(1, 'Promotion name is required'),
    type: z.enum(['FIXED', 'PERCENT', 'COMBO']),
    value: z.number().positive('Value must be positive'),
    scope: z.enum(['ITEM', 'CATEGORY']),
    menuItemId: z.string().optional(),
    categoryId: z.string().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    rules: z.array(
        z.object({
            requiredQuantity: z.number().positive(),
            menuItemId: z.string().optional(),
            categoryId: z.string().optional(),
            isDiscounted: z.boolean().default(false),
            name: z.string().optional()
        })
    ).optional(),
});

export type PromotionInput = z.infer<typeof promotionSchema>;

// ─── Cart Types (Client-side) ────────────────────────────────

export interface CartItem {
    menuItemId: string;
    name: string;
    categoryId: string;
    quantity: number;
    basePrice: number;
    effectivePrice: number;
    discount: number;
    notes?: string;
}

export interface ActivePromotion {
    id: string;
    name: string;
    type: 'FIXED' | 'PERCENT';
    value: number;
    scope: 'ITEM' | 'CATEGORY';
    menuItemId?: string | null;
    categoryId?: string | null;
}
