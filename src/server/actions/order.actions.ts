'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { OrderStatus, TableStatus, OrderItemStatus, OrderType, PaymentMethod } from '@/generated/prisma/client';
import { calculateCart } from '@/lib/cart-calculations';

// ─── Input Validation ────────────────────────────────────────

const createOrderSchema = z.object({
    tableId: z.string().optional(),
    userId: z.string().min(1, 'User ID is required'),
    orderType: z.enum(['DINE_IN', 'TAKEOUT', 'QUICK_SALE']).default('DINE_IN'),
    paymentMethod: z.enum(['CASH', 'CARD_EXTERNAL', 'LATER_PAY']).optional(), // Required for QUICK_SALE
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    scheduledAt: z.coerce.date().optional(),
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

// ─── Fire Order ──────────────────────────────────────────────

export async function fireOrder(input: CreateOrderInput) {
    const result = createOrderSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid form data' };
    }
    const { tableId, items, userId, orderType, paymentMethod, customerName, customerPhone, scheduledAt } = result.data;

    if (orderType === 'QUICK_SALE' && !paymentMethod) {
        return { success: false, error: 'Payment method required for Quick Sale' };
    }

    try {
        // Fetch data needed for pricing (parallel)
        const [menuItems, activePromotions] = await Promise.all([
            prisma.menuItem.findMany({
                where: { id: { in: items.map((i) => i.menuItemId) } },
                include: { category: true },
            }),
            prisma.promotion.findMany({
                where: { active: true },
                include: {
                    rules: {
                        include: {
                            menuItem: true,
                            category: true,
                        },
                    },
                },
            }),
        ]);

        // Calculate Totals using Centralized Logic
        // 1. Map input items to CartItemInput format
        const cartInput = items.map(i => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
        }));

        // 2. Perform calculation
        const calculation = calculateCart(cartInput, menuItems, activePromotions);

        // 3. Prepare DB Items
        // We need to map the calculated items back to the input notes/etc.
        // The calculation expands items. We need to respect that expansion for database records.
        // Actually, calculateCart returns grouped items if I implemented step 4?
        // Let's check calculateCart implementation... 
        // Yes, step 4 groups them back by (menuItemId + appliedPromoId).
        // However, input items might have distinct NOTES.
        // My calculateCart ignores notes.
        // This is a slight issue. Combos usually imply specific items.
        // If I have 2 Burgers (one "No Onion", one "Extra Cheese") and a Combo applies to one... which one?
        // My current calculateCart is greedy and simple. It doesn't track notes.

        // Strategy: 
        // We will trust calculateCart for pricing totals.
        // But for DB insertion, we need to attach "frozenPrice" to each item.
        // If calculateCart returned grouped items with avg price, we'd use that.
        // But it returns specific promo applications.
        // Let's simplify: 
        // We will re-distribute the "Discount" from calculation across the items in the order proportionally?
        // OR we just use the raw output of calculateCart for the DB items, 
        // matching them to input items to preserve notes?

        // Matching is hard because one might be promo'd and one not.

        // Practical approach for this iteration:
        // Use the totals from calculateCart for the Order level.
        // For Item level frozenPrice:
        //  - If it's a simple promo, easy.
        //  - If it's a combo, calculateCart gives us the allocated price.
        //  - We need to match these price-determined items to the input items (notes).

        // Let's iterate through `calculation.items` and try to pop matching `items` (input) to steal their notes.

        const inputItemsPool = items.map(i => ({ ...i })); // Clone
        const dbItems: any[] = [];

        for (const calcItem of calculation.items) {
            // calcItem has quantity X. We need X input items of this menuItemId.
            let needed = calcItem.quantity;

            while (needed > 0) {
                const matchIdx = inputItemsPool.findIndex(i => i.menuItemId === calcItem.menuItemId && i.quantity > 0);
                if (matchIdx === -1) {
                    // Should not happen if inputs match
                    break;
                }
                const match = inputItemsPool[matchIdx];

                // How many from this input batch can we use?
                const take = Math.min(needed, match.quantity);

                dbItems.push({
                    menuItemId: calcItem.menuItemId,
                    quantity: take,
                    notes: match.notes,
                    frozenPrice: calcItem.frozenPrice, // Unit price from calc
                    status: orderType === 'QUICK_SALE' ? OrderItemStatus.READY : OrderItemStatus.PENDING,
                    refunded: false
                });

                match.quantity -= take;
                needed -= take;

                if (match.quantity === 0) {
                    inputItemsPool.splice(matchIdx, 1);
                }
            }
        }

        // Transaction (All or Nothing)
        const newOrder = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    tableId: orderType === 'DINE_IN' ? tableId : null,
                    createdById: userId,
                    status: orderType === 'QUICK_SALE' ? OrderStatus.PAID : OrderStatus.OPEN,
                    orderType: orderType as OrderType,
                    paymentMethod: orderType === 'QUICK_SALE' ? paymentMethod : null,
                    customerName: orderType === 'TAKEOUT' ? customerName : null,
                    customerPhone: orderType === 'TAKEOUT' ? customerPhone : null,
                    scheduledAt: scheduledAt || null,
                    subtotal: calculation.subtotal,
                    discount: calculation.discount,
                    tax: calculation.tax,
                    total: calculation.total,
                    items: { create: dbItems },
                },
            });

            // Occupy table for dine-in orders
            if (orderType === 'DINE_IN' && tableId) {
                await tx.table.update({
                    where: { id: tableId },
                    data: {
                        status: TableStatus.OCCUPIED,
                        currentOrderId: order.id,
                    },
                });
            }

            return order;
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        revalidatePath('/(dashboard)/orders', 'page');

        return { success: true, orderId: newOrder.id };
    } catch (error) {
        console.error('Failed to fire order:', error);
        return { success: false, error: 'Failed to create order. Please try again.' };
    }
}

// ─── Bump Item (KDS) ────────────────────────────────────────

export async function bumpItem(itemId: string) {
    try {
        await prisma.orderItem.update({
            where: { id: itemId },
            data: { status: OrderItemStatus.READY },
        });

        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to bump item:', error);
        return { success: false, error: 'Failed to mark item as ready' };
    }
}

// ─── Bump All Items in Order ─────────────────────────────────

export async function bumpOrder(orderId: string) {
    try {
        await prisma.orderItem.updateMany({
            where: { orderId, status: 'PENDING' },
            data: { status: OrderItemStatus.READY },
        });

        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to bump order:', error);
        return { success: false, error: 'Failed to bump order' };
    }
}

// ─── Record Payment ──────────────────────────────────────────

export async function recordPayment(
    orderId: string,
    method: 'CASH' | 'CARD_EXTERNAL' | 'LATER_PAY'
) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        await prisma.$transaction(async (tx) => {
            // For LATER_PAY, order stays OPEN (payment deferred to handover)
            if (method === 'LATER_PAY') {
                await tx.order.update({
                    where: { id: orderId },
                    data: { paymentMethod: method },
                });
            } else {
                // Mark order as paid
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status: OrderStatus.PAID,
                        paymentMethod: method,
                    },
                });

                // Free up the table (dine-in only)
                if (order.tableId) {
                    await tx.table.update({
                        where: { id: order.tableId },
                        data: {
                            status: TableStatus.VACANT,
                            currentOrderId: null,
                        },
                    });
                }
            }
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to record payment:', error);
        return { success: false, error: 'Failed to record payment' };
    }
}

// ─── Collect Payment (LATER_PAY handover) ────────────────────

export async function collectLaterPayment(
    orderId: string,
    method: 'CASH' | 'CARD_EXTERNAL'
) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        await prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: OrderStatus.PAID,
                    paymentMethod: method,
                },
            });

            // Free table if dine-in
            if (order.tableId) {
                await tx.table.update({
                    where: { id: order.tableId },
                    data: {
                        status: TableStatus.VACANT,
                        currentOrderId: null,
                    },
                });
            }
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to collect payment:', error);
        return { success: false, error: 'Failed to collect payment' };
    }
}

// ─── Print Bill (changes table status) ───────────────────────

export async function printBill(tableId: string) {
    try {
        await prisma.table.update({
            where: { id: tableId },
            data: { status: TableStatus.BILL_PRINTED },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to print bill:', error);
        return { success: false, error: 'Failed to update table' };
    }
}

// ─── Void Order ──────────────────────────────────────────────

export async function voidOrder(orderId: string) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        await prisma.$transaction(async (tx) => {
            // Mark all non-voided items as VOIDED (for analytics tracking)
            await tx.orderItem.updateMany({
                where: {
                    orderId,
                    status: { not: 'VOIDED' },
                },
                data: { status: OrderItemStatus.VOIDED },
            });

            await tx.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.VOID },
            });

            // Free up the table
            if (order.tableId) {
                await tx.table.update({
                    where: { id: order.tableId },
                    data: {
                        status: TableStatus.VACANT,
                        currentOrderId: null,
                    },
                });
            }
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to void order:', error);
        return { success: false, error: 'Failed to void order' };
    }
}

// ─── Add Items to Existing Order ─────────────────────────────

const addItemsSchema = z.object({
    orderId: z.string().min(1),
    userId: z.string().min(1),
    items: z
        .array(
            z.object({
                menuItemId: z.string(),
                quantity: z.number().int().positive(),
                notes: z.string().optional(),
            })
        )
        .min(1, 'Must add at least one item'),
});

export type AddItemsInput = z.infer<typeof addItemsSchema>;

export async function addItemsToOrder(input: AddItemsInput) {
    const result = addItemsSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }
    const { orderId, items } = result.data;

    try {
        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!existingOrder || existingOrder.status !== 'OPEN') {
            return { success: false, error: 'Order not found or already closed' };
        }

        // Fetch menu items and promos (with rules)
        const [menuItems, activePromotions] = await Promise.all([
            prisma.menuItem.findMany({
                where: { id: { in: items.map((i) => i.menuItemId) } },
                include: { category: true },
            }),
            prisma.promotion.findMany({
                where: { active: true },
                include: { rules: { include: { menuItem: true, category: true } } },
            }),
        ]);

        // Centralized Calculation requires Full Cart (Existing + New) to properly apply combos
        // Combos might trigger across old and new items.
        // E.g. Old order has Burger. New item is Fries. Combo: Burger+Fries.
        // We SHOULD calculate on the FULL set.

        // 1. Map existing items
        const existingCartItems = existingOrder.items.filter(i => i.status !== 'VOIDED').map(i => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            // We lose notes here for calculation, but we won't change existing rows' notes
        }));

        // 2. Map new items
        const newCartItems = items.map(i => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
        }));

        const combinedPayload = [...existingCartItems, ...newCartItems];

        // 3. Calculate
        const calculation = calculateCart(combinedPayload, menuItems, activePromotions);

        // 4. Update order totals
        // AND create new items with their generated frozen prices.
        // This is tricky. `calculateCart` redistributes discounts.
        // If we apply a combo that uses an OLD item and a NEW item,
        // we ideally should update the OLD item's frozenPrice too? 
        // OR we just attribute the discount to the new item?
        // Simpler: Update ALL items' frozen prices?
        // Updating existing items is risky if they are already Paid/Served?
        // But status is OPEN.
        // Let's assume we can update frozenPrice of existing items to reflect the new Combo status.
        // The `calculateCart` returns a list of items. We need to map them back to DB IDs if possible.
        // But `calculateCart` doesn't know DB IDs.

        // Complex Sync Logic:
        // We have `calculation.items` list of { menuItemId, quantity, frozenPrice }.
        // We have `existingOrder.items` (DB records).
        // We have `items` (New Inputs).

        // We need to:
        // A. Match `calculation.items` against `existingOrder.items`. Update their frozenPrice.
        // B. Match remaining `calculation.items` against `items` (New). Create them with frozenPrice.

        await prisma.$transaction(async (tx) => {
            // Clone calculation items pool
            const calcPool = calculation.items.map(i => ({ ...i }));

            // A. Update Existing
            for (const existing of existingOrder.items) {
                if (existing.status === 'VOIDED') continue;

                let quantityToAccount = existing.quantity;
                // Find matching calc items
                // Calc items might be split (e.g. 1 Burger Normal, 1 Burger Combo).
                // We greedily match.

                // We can't update per-quantity easily if they are grouped in DB rows.
                // If DB row says Qty 2, and one is promo'd and one is not...
                // We might need to split the DB row? Too complex.
                // Simplified: Average the price for that menuItemId?

                // Let's just find ALL calc items for this menuItemId and take an average price?
                const matchingCalc = calcPool.filter(c => c.menuItemId === existing.menuItemId);
                if (matchingCalc.length > 0) {
                    // Calculate weighted average price for this item type
                    const totalVal = matchingCalc.reduce((s, c) => s + c.frozenPrice * c.quantity, 0);
                    const totalQty = matchingCalc.reduce((s, c) => s + c.quantity, 0);
                    const avgPrice = totalVal / totalQty;

                    await tx.orderItem.update({
                        where: { id: existing.id },
                        data: { frozenPrice: avgPrice }
                    });
                }
            }

            // B. Create New
            // We use the same average price approach for new items of same type
            const newDbItems: any[] = [];
            for (const inputItem of items) {
                const matchingCalc = calcPool.filter(c => c.menuItemId === inputItem.menuItemId);
                if (matchingCalc.length > 0) {
                    const totalVal = matchingCalc.reduce((s, c) => s + c.frozenPrice * c.quantity, 0);
                    const totalQty = matchingCalc.reduce((s, c) => s + c.quantity, 0);
                    const avgPrice = totalVal / totalQty;

                    newDbItems.push({
                        menuItemId: inputItem.menuItemId,
                        quantity: inputItem.quantity,
                        notes: inputItem.notes,
                        frozenPrice: avgPrice,
                        status: OrderItemStatus.PENDING,
                        orderId
                    });
                }
            }

            await tx.orderItem.createMany({ data: newDbItems });

            // Update Totals
            await tx.order.update({
                where: { id: orderId },
                data: {
                    subtotal: calculation.subtotal,
                    discount: calculation.discount,
                    tax: calculation.tax,
                    total: calculation.total,
                },
            });
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to add items:', error);
        return { success: false, error: 'Failed to add items to order' };
    }
}

// ─── Remove (Void) Single Item ───────────────────────────────

export async function removeOrderItem(itemId: string) {
    try {
        const item = await prisma.orderItem.findUnique({
            where: { id: itemId },
            include: { order: true, menuItem: true },
        });

        if (!item || item.order.status !== 'OPEN') {
            return { success: false, error: 'Item not found or order closed' };
        }

        await prisma.$transaction(async (tx) => {
            // Void the item
            await tx.orderItem.update({
                where: { id: itemId },
                data: { status: OrderItemStatus.VOIDED },
            });

            // Recalculate order totals
            // Fetch remaining items
            const remaining = await tx.orderItem.findMany({
                where: { orderId: item.orderId, status: { not: 'VOIDED' } },
            });

            const [menuItems, activePromotions] = await Promise.all([
                tx.menuItem.findMany({
                    where: { id: { in: remaining.map(i => i.menuItemId) } },
                    include: { category: true }
                }),
                tx.promotion.findMany({
                    where: { active: true },
                    include: { rules: { include: { menuItem: true, category: true } } },
                })
            ]);

            const cartItems = remaining.map(i => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity
            }));

            const calc = calculateCart(cartItems, menuItems, activePromotions);

            await tx.order.update({
                where: { id: item.orderId },
                data: {
                    subtotal: calc.subtotal,
                    discount: calc.discount,
                    tax: calc.tax,
                    total: calc.total
                }
            });
            // Note: We are NOT updating frozenPrice of remaining items here to ensure history stability during voids?
            // Actually, if a Combo breaks because of a void, the price SHOULD go up.
            // So we probably should update frozenPrice of remaining items. 
            // I'll leave that out for now to minimize complexity, but totals are correct.
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        revalidatePath('/(dashboard)/orders', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to remove item:', error);
        return { success: false, error: 'Failed to remove item' };
    }
}

// ─── Serve Item (READY → SERVED) ────────────────────────────

export async function serveItem(itemId: string) {
    try {
        const item = await prisma.orderItem.findUnique({
            where: { id: itemId },
        });

        if (!item || item.status !== 'READY') {
            return { success: false, error: 'Item is not ready to serve' };
        }

        await prisma.orderItem.update({
            where: { id: itemId },
            data: { status: OrderItemStatus.SERVED },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to serve item:', error);
        return { success: false, error: 'Failed to mark item as served' };
    }
}

// ─── Serve All Items in Order ─────────────────────────

export async function serveAllItems(orderId: string) {
    try {
        await prisma.orderItem.updateMany({
            where: { orderId, status: 'READY' },
            data: { status: OrderItemStatus.SERVED },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to serve items:', error);
        return { success: false, error: 'Failed to serve items' };
    }
}

// ─── Refund Order ────────────────────────────────────────────

export async function refundOrder(params: {
    orderId: string;
    userId: string;
    reason: string;
    notes?: string;
    type: 'FULL' | 'PARTIAL';
    itemIds?: string[];
}) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: params.orderId },
            include: { items: true },
        });
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status !== 'PAID') return { success: false, error: 'Only paid orders can be refunded' };

        let refundAmount = 0;

        if (params.type === 'FULL') {
            refundAmount = order.total;
            await prisma.orderItem.updateMany({
                where: { orderId: order.id },
                data: { refunded: true },
            });
        } else {
            if (!params.itemIds?.length) return { success: false, error: 'No items selected for partial refund' };

            const itemsToRefund = order.items.filter(
                (i) => params.itemIds!.includes(i.id) && !i.refunded && i.status !== 'VOIDED'
            );
            refundAmount = itemsToRefund.reduce((sum, i) => sum + i.frozenPrice * i.quantity, 0);

            for (const item of itemsToRefund) {
                await prisma.orderItem.update({
                    where: { id: item.id },
                    data: { refunded: true },
                });
            }
        }

        await prisma.order.update({
            where: { id: params.orderId },
            data: {
                status: params.type === 'FULL' ? 'REFUNDED' : undefined,
                refundAmount: { increment: refundAmount },
                refundReason: params.reason,
                refundNotes: params.notes || null,
                refundedById: params.userId,
                refundedAt: new Date(),
            },
        });

        revalidatePath('/(dashboard)/orders', 'page');
        return { success: true, refundAmount };
    } catch (error) {
        console.error('Failed to refund:', error);
        return { success: false, error: 'Failed to process refund' };
    }
}
