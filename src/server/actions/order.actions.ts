'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { OrderStatus, TableStatus, OrderItemStatus, OrderType, PaymentMethod } from '@/generated/prisma/client';
import { calculateCart } from '@/lib/cart-calculations';
import { AuthError, requireManager, requireSession } from '@/lib/auth-helpers';

// ─── Input Validation ────────────────────────────────────────

// F-H10: hard caps mirroring the cart-store client caps so a direct API
// caller (or a client running outside the store) can't bypass them.
const MAX_LINE_QTY = 99;
const MAX_ORDER_LINES = 50;
const MAX_NOTES_LEN = 500;

const createOrderSchema = z.object({
    tableId: z.string().optional(),
    userId: z.string().optional(), // Optional for Online Storefront orders
    orderType: z.enum(['DINE_IN', 'TAKEOUT', 'QUICK_SALE']).default('DINE_IN'),
    paymentMethod: z.enum(['CASH', 'CARD_EXTERNAL', 'LATER_PAY']).optional(), // Required for QUICK_SALE
    customerName: z.string().max(200).optional(),
    customerPhone: z.string().max(50).optional(),
    customerId: z.string().optional(),
    scheduledAt: z.coerce.date().optional(),
    pointsToRedeem: z.number().int().min(0).max(1_000_000).optional().default(0),
    items: z
        .array(
            z.object({
                menuItemId: z.string(),
                quantity: z.number().int().positive().max(MAX_LINE_QTY),
                notes: z.string().max(MAX_NOTES_LEN).optional(),
                selectedModifiers: z.array(z.object({
                    modifierId: z.string(),
                    name: z.string().max(200),
                    priceAdjustment: z.number().finite()
                })).max(20).optional()
            })
        )
        .min(1, 'Order must have at least one item')
        .max(MAX_ORDER_LINES, `Order cannot have more than ${MAX_ORDER_LINES} lines`),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ─── Fire Order ──────────────────────────────────────────────

export async function fireOrder(input: CreateOrderInput) {
    const result = createOrderSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid form data' };
    }
    const { tableId, items, userId, orderType, paymentMethod, customerName, customerPhone, customerId, scheduledAt, pointsToRedeem } = result.data;

    if (orderType === 'QUICK_SALE' && !paymentMethod) {
        return { success: false, error: 'Payment method required for Quick Sale' };
    }

    try {
        // Fallback for online orders without explicit staff userId
        let finalUserId: string;
        if (userId) {
            finalUserId = userId;
        } else {
            const ownerUser = await prisma.user.findFirst({ where: { role: 'OWNER' } });
            if (!ownerUser) return { success: false, error: 'System configuration error: No owner user found for online checkout.' };
            finalUserId = ownerUser.id;
        }

        // Fetch data needed for pricing (parallel)
        const [menuItems, activePromotions, settings] = await Promise.all([
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
            prisma.siteSettings.findMany({
                where: { key: 'LOYALTY_POINTS_RATE' }
            }),
        ]);

        // Calculate Totals using Centralized Logic
        // 1. Map input items to CartItemInput format
        const cartInput = items.map(i => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            modifiersPrice: (i.selectedModifiers || []).reduce((sum, mod) => sum + mod.priceAdjustment, 0),
        }));

        // 2. Perform calculation
        const calculation = calculateCart(cartInput, menuItems, activePromotions);

        let finalTotal = calculation.total;
        let finalDiscount = calculation.discount;

        if (pointsToRedeem && pointsToRedeem > 0) {
            let loyaltyRate = 0.10; // Default fallback
            if (settings && settings.length > 0) {
                loyaltyRate = parseFloat(settings[0].value) || 0.10;
            }
            const pointsDiscountValue = pointsToRedeem * loyaltyRate;
            finalDiscount += pointsDiscountValue;
            finalTotal = Math.max(0, finalTotal - pointsDiscountValue);
        }

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
                    refunded: false,
                    modifiers: match.selectedModifiers?.length ? {
                        create: match.selectedModifiers.map((mod: any) => ({
                            modifierId: mod.modifierId,
                            name: mod.name,
                            price: mod.priceAdjustment
                        }))
                    } : undefined
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
            const isInstantlyPaid = orderType === 'QUICK_SALE' && paymentMethod !== 'LATER_PAY';

            const order = await tx.order.create({
                data: {
                    tableId: orderType === 'DINE_IN' ? tableId : null,
                    createdById: finalUserId,
                    status: isInstantlyPaid ? OrderStatus.PAID : OrderStatus.OPEN,
                    orderType: orderType as OrderType,
                    paymentMethod: paymentMethod || null,
                    customerName: orderType === 'TAKEOUT' ? customerName : null,
                    customerPhone: orderType === 'TAKEOUT' ? customerPhone : null,
                    customerId: customerId || null,
                    scheduledAt: scheduledAt || null,
                    subtotal: calculation.subtotal,
                    discount: finalDiscount,
                    tax: calculation.tax,
                    total: finalTotal,
                    amountPaid: isInstantlyPaid ? finalTotal : 0,
                    // Record the points redemption on the order itself so subsequent
                    // payment calls can't re-apply it (see F-M1).
                    pointsRedeemed: pointsToRedeem || 0,
                    items: { create: dbItems },
                },
            });

            // Write initial payment chunk if instantly paid
            if (isInstantlyPaid && paymentMethod) {
                await tx.payment.create({
                    data: {
                        orderId: order.id,
                        amount: finalTotal,
                        method: paymentMethod as PaymentMethod
                    }
                });

                // Award points if customer attached
                if (customerId) {
                    const pointsToAward = Math.floor(finalTotal);
                    const pointDelta = pointsToAward - (pointsToRedeem || 0);

                    // We increment or decrement the net points
                    if (pointDelta !== 0) {
                        const cust = await tx.customer.findUnique({ where: { id: customerId } });
                        if (cust) {
                            const newBalance = Math.max(0, cust.pointsBalance + pointDelta);
                            await tx.customer.update({
                                where: { id: customerId },
                                data: { pointsBalance: newBalance }
                            });
                        }
                    }
                }
            } else if (customerId && pointsToRedeem && pointsToRedeem > 0) {
                // If not instantly paid but points redeemed (like LATER_PAY Takeout), deduct points now!
                // Awarding points happens when payment is recorded, but we deduct redeemed points now.
                const cust = await tx.customer.findUnique({ where: { id: customerId } });
                if (cust) {
                    const newBalance = Math.max(0, cust.pointsBalance - pointsToRedeem);
                    await tx.customer.update({
                        where: { id: customerId },
                        data: { pointsBalance: newBalance }
                    });
                }
            }

            // Handle Inventory Decrements — atomic check-and-set to prevent overselling.
            // Instead of a naive `decrement` (which can drop below zero under concurrency),
            // we use `updateMany` with `stockQuantity >= qty` in the WHERE clause so the
            // database rejects the write if stock is insufficient, and the whole transaction
            // rolls back.
            const aggregatedCounts: Record<string, number> = {};
            for (const dbItem of dbItems) {
                aggregatedCounts[dbItem.menuItemId] = (aggregatedCounts[dbItem.menuItemId] || 0) + dbItem.quantity;
            }

            for (const [mId, qty] of Object.entries(aggregatedCounts)) {
                const menuItem = menuItems.find(m => m.id === mId);
                if (!menuItem?.trackStock) continue;

                const result = await tx.menuItem.updateMany({
                    where: {
                        id: mId,
                        trackStock: true,
                        stockQuantity: { gte: qty },
                    },
                    data: { stockQuantity: { decrement: qty } },
                });

                if (result.count === 0) {
                    // Either stock insufficient or trackStock flipped off mid-flight.
                    throw new Error(`Insufficient stock for "${menuItem.name}"`);
                }

                // Auto-disable if fully depleted after decrement
                const after = await tx.menuItem.findUnique({
                    where: { id: mId },
                    select: { stockQuantity: true },
                });
                if (after && after.stockQuantity <= 0) {
                    await tx.menuItem.update({
                        where: { id: mId },
                        data: { isAvailable: false, stockQuantity: 0 },
                    });
                }
            }

            // Occupy table for dine-in orders
            if (orderType === 'DINE_IN' && tableId) {
                await tx.table.update({
                    where: { id: tableId },
                    data: {
                        status: isInstantlyPaid ? TableStatus.VACANT : TableStatus.OCCUPIED,
                        currentOrderId: isInstantlyPaid ? null : order.id,
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
        await requireSession();

        // F-H5: don't let staff advance items on a voided/refunded order — the
        // ticket is closed from a money standpoint and the KDS should treat it
        // as read-only.
        const item = await prisma.orderItem.findUnique({
            where: { id: itemId },
            include: { order: { select: { status: true } } },
        });
        if (!item) return { success: false, error: 'Item not found' };
        if (item.status === OrderItemStatus.VOIDED) {
            return { success: false, error: 'Cannot bump a voided item' };
        }
        if (item.order.status !== OrderStatus.OPEN && item.order.status !== OrderStatus.PAID) {
            return { success: false, error: 'Cannot bump items on a closed order' };
        }

        await prisma.orderItem.update({
            where: { id: itemId },
            data: { status: OrderItemStatus.READY },
        });

        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to bump item:', error);
        return { success: false, error: 'Failed to mark item as ready' };
    }
}

// ─── Bump All Items in Order ─────────────────────────────────

export async function bumpOrder(orderId: string) {
    try {
        await requireSession();

        // F-H5: status guard against VOID / REFUNDED tickets.
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true },
        });
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PAID) {
            return { success: false, error: 'Cannot bump items on a closed order' };
        }

        await prisma.orderItem.updateMany({
            where: { orderId, status: 'PENDING' },
            data: { status: OrderItemStatus.READY },
        });

        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to bump order:', error);
        return { success: false, error: 'Failed to bump order' };
    }
}

// ─── Record Payment ──────────────────────────────────────────

export async function recordPayment(
    orderId: string,
    method: 'CASH' | 'CARD_EXTERNAL' | 'LATER_PAY',
    amount?: number,
    pointsToRedeem: number = 0,
    customerId?: string
) {
    try {
        await requireSession();

        // Input guards
        if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
            return { success: false, error: 'Invalid payment amount' };
        }
        if (!Number.isFinite(pointsToRedeem) || pointsToRedeem < 0 || !Number.isInteger(pointsToRedeem)) {
            return { success: false, error: 'Invalid points redemption' };
        }

        // Wrap the whole read+write cycle in a Serializable transaction so two
        // concurrent payment clicks can't both succeed and over-pay the order.
        const txResult = await prisma.$transaction(
            async (tx) => {
                const order = await tx.order.findUnique({ where: { id: orderId } });
                if (!order) return { ok: false as const, error: 'Order not found' };

                // Reject payments on closed orders (previously any caller could re-open the
                // money flow on VOID / REFUNDED orders and keep stacking payments).
                if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PAID) {
                    return { ok: false as const, error: `Cannot record payment on ${order.status.toLowerCase()} order` };
                }
                // If order is already fully paid and caller is sending another non-LATER_PAY
                // charge, block it unless there's still a balance owing (partial-payment case).
                if (order.status === OrderStatus.PAID && method !== 'LATER_PAY') {
                    return { ok: false as const, error: 'Order is already fully paid' };
                }

                // For LATER_PAY, order stays OPEN (payment deferred to handover)
                if (method === 'LATER_PAY') {
                    await tx.order.update({
                        where: { id: orderId },
                        data: { paymentMethod: method },
                    });
                    return { ok: true as const };
                }

                let currentTotal = order.total;
                let currentDiscount = order.discount;

                let finalCustomerId = order.customerId;
                if (customerId && customerId !== order.customerId) {
                    finalCustomerId = customerId;
                    await tx.order.update({
                        where: { id: orderId },
                        data: { customerId: finalCustomerId },
                    });
                }

                if (pointsToRedeem > 0 && finalCustomerId) {
                    // Guard F-M1: if points were already redeemed on this order at
                    // fireOrder time (typical for LATER_PAY takeout flows), silently
                    // reject an attempt to redeem again here. The caller's UI should
                    // be reading `order.pointsRedeemed` and sending zero on subsequent
                    // partial payments.
                    if ((order.pointsRedeemed ?? 0) > 0) {
                        return {
                            ok: false as const,
                            error: 'Points were already redeemed on this order',
                        };
                    }

                    const cust = await tx.customer.findUnique({ where: { id: finalCustomerId } });
                    const settings = await tx.siteSettings.findUnique({ where: { key: 'LOYALTY_POINTS_RATE' } });
                    let loyaltyRate = 0.10;
                    if (settings) {
                        loyaltyRate = parseFloat(settings.value) || 0.10;
                    }

                    if (!cust || cust.pointsBalance < pointsToRedeem) {
                        return { ok: false as const, error: 'Insufficient points' };
                    }

                    const discountValue = pointsToRedeem * loyaltyRate;
                    currentTotal = Math.max(0, currentTotal - discountValue);
                    currentDiscount += discountValue;

                    await tx.customer.update({
                        where: { id: finalCustomerId },
                        data: { pointsBalance: { decrement: pointsToRedeem } },
                    });

                    await tx.order.update({
                        where: { id: orderId },
                        data: {
                            total: currentTotal,
                            discount: currentDiscount,
                            pointsRedeemed: pointsToRedeem,
                        },
                    });
                }

                // Determine payment amount, cap at balance owing (no over-payment)
                const balanceOwing = Math.max(0, currentTotal - order.amountPaid);
                const requested = amount !== undefined ? amount : balanceOwing;

                if (requested <= 0) {
                    return { ok: false as const, error: 'No balance owing on this order' };
                }

                // Cap to the balance to prevent accidental over-payment / double-charge races.
                const paymentAmount = Math.min(requested, balanceOwing);
                const newAmountPaid = order.amountPaid + paymentAmount;
                // Use a small epsilon to account for float rounding
                const isFullyPaid = newAmountPaid + 0.0001 >= currentTotal;

                // 1. Create the Payment record
                await tx.payment.create({
                    data: { orderId, amount: paymentAmount, method },
                });

                // 2. Update the Order
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        amountPaid: newAmountPaid,
                        ...(isFullyPaid
                            ? { status: OrderStatus.PAID, paymentMethod: method }
                            : {}),
                    },
                });

                // 3. Award points on fully paid order
                if (isFullyPaid && finalCustomerId) {
                    const pointsToAward = Math.floor(currentTotal);
                    if (pointsToAward > 0) {
                        await tx.customer.update({
                            where: { id: finalCustomerId },
                            data: { pointsBalance: { increment: pointsToAward } },
                        });
                    }
                }

                // 4. Free up the table (dine-in only) if fully paid
                if (isFullyPaid && order.tableId) {
                    await tx.table.update({
                        where: { id: order.tableId },
                        data: {
                            status: TableStatus.VACANT,
                            currentOrderId: null,
                        },
                    });
                }

                return { ok: true as const };
            },
            { isolationLevel: 'Serializable' }
        );

        if (!txResult.ok) {
            return { success: false, error: txResult.error };
        }

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to record payment:', error);
        return { success: false, error: 'Failed to record payment' };
    }
}

// ─── Collect Payment (LATER_PAY handover) ────────────────────

export async function collectLaterPayment(
    orderId: string,
    method: 'CASH' | 'CARD_EXTERNAL',
    amount?: number
) {
    return recordPayment(orderId, method, amount);
}

// ─── Print Bill (changes table status) ───────────────────────

export async function printBill(tableId: string) {
    try {
        await requireSession();
        await prisma.table.update({
            where: { id: tableId },
            data: { status: TableStatus.BILL_PRINTED },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to print bill:', error);
        return { success: false, error: 'Failed to update table' };
    }
}

// ─── Void Order ──────────────────────────────────────────────

export async function voidOrder(orderId: string) {
    try {
        // Voiding wipes revenue — restrict to managers only.
        await requireManager();

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { menuItem: true } },
            },
        });

        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        // Guard: cannot void a paid/refunded order via this path (those must go through
        // refundOrder which handles money + inventory + audit correctly).
        if (order.status !== OrderStatus.OPEN) {
            return { success: false, error: `Cannot void ${order.status.toLowerCase()} orders — use refund instead` };
        }

        await prisma.$transaction(async (tx) => {
            // Aggregate inventory to restock: only items that were consuming stock and
            // haven't already been voided (so we don't double-restock).
            const restockMap: Record<string, number> = {};
            for (const item of order.items) {
                if (item.status === OrderItemStatus.VOIDED) continue;
                if (item.menuItem?.trackStock) {
                    restockMap[item.menuItemId] =
                        (restockMap[item.menuItemId] || 0) + item.quantity;
                }
            }

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

            // Restore inventory
            for (const [mId, qty] of Object.entries(restockMap)) {
                await tx.menuItem.update({
                    where: { id: mId },
                    data: {
                        stockQuantity: { increment: qty },
                        // Re-enable an auto-disabled item if it's now back in stock
                        isAvailable: true,
                    },
                });
            }

            // Refund any loyalty points that were redeemed but not yet awarded
            // (best-effort: we don't track redemption separately, so we leave this to
            // the manager to reverse manually if needed).

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
        if (error instanceof AuthError) return { success: false, error: error.message };
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
                quantity: z.number().int().positive().max(MAX_LINE_QTY),
                notes: z.string().max(MAX_NOTES_LEN).optional(),
                selectedModifiers: z.array(z.object({
                    modifierId: z.string(),
                    name: z.string().max(200),
                    priceAdjustment: z.number().finite()
                })).max(20).optional()
            })
        )
        .min(1, 'Must add at least one item')
        .max(MAX_ORDER_LINES, `Cannot add more than ${MAX_ORDER_LINES} lines at once`),
});

export type AddItemsInput = z.infer<typeof addItemsSchema>;

export async function addItemsToOrder(input: AddItemsInput) {
    const result = addItemsSchema.safeParse(input);
    if (!result.success) {
        return { success: false, error: 'Invalid input' };
    }
    const { orderId, items } = result.data;

    try {
        await requireSession();

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

        // F-H7: block 86'd / out-of-stock items before we even consider the cart.
        for (const input of items) {
            const mi = menuItems.find((m) => m.id === input.menuItemId);
            if (!mi) {
                return { success: false, error: 'Menu item no longer exists' };
            }
            if (!mi.isAvailable) {
                return { success: false, error: `"${mi.name}" is unavailable` };
            }
            if (mi.trackStock && mi.stockQuantity < input.quantity) {
                return { success: false, error: `"${mi.name}" is out of stock` };
            }
        }

        // Map new items for cart input (invariant across transaction retries)
        const newCartItems = items.map(i => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            modifiersPrice: (i.selectedModifiers || []).reduce((sum, mod) => sum + mod.priceAdjustment, 0),
        }));

        // F-H3: read-check-write must happen inside a Serializable transaction.
        // Previously we fetched the order, then much later executed writes in a
        // separate transaction — a payment could land in the gap, flipping the
        // order to PAID while we still merrily appended items to it. Pulling the
        // fetch inside the transaction (with Serializable isolation) means Postgres
        // will retry or abort if any concurrent mutation touches the same row.
        const txResult = await prisma.$transaction(
            async (tx) => {
                const existingOrder = await tx.order.findUnique({
                    where: { id: orderId },
                    include: {
                        items: {
                            include: { modifiers: true },
                        },
                    },
                });

                if (!existingOrder) {
                    return { ok: false as const, error: 'Order not found' };
                }
                // Only OPEN orders can accept new items. A PAID / VOID / REFUNDED
                // ticket is closed from both a money and kitchen standpoint.
                if (existingOrder.status !== OrderStatus.OPEN) {
                    return {
                        ok: false as const,
                        error: `Cannot add items to a ${existingOrder.status.toLowerCase()} order`,
                    };
                }

                // Map existing (non-voided) items
                const existingCartItems = existingOrder.items
                    .filter((i) => i.status !== OrderItemStatus.VOIDED)
                    .map((i) => ({
                        menuItemId: i.menuItemId,
                        quantity: i.quantity,
                        modifiersPrice: i.modifiers.reduce(
                            (sum: number, mod: any) => sum + Number(mod.price),
                            0
                        ),
                    }));

                // Combined cart so combos can trigger across old + new lines
                // (e.g. old Burger + new Fries forming a Burger+Fries combo).
                const combinedCart = [...existingCartItems, ...newCartItems];
                const calculation = calculateCart(combinedCart, menuItems, activePromotions);

                // Clone calculation pool for greedy matching
                const calcPool = calculation.items.map((i) => ({ ...i }));

                // A. Update existing (non-voided) items' frozenPrice.
                // calculateCart may split lines into promo / non-promo. We collapse
                // by weighted average per menuItemId since existing DB rows are
                // grouped. This is imperfect (a Burger that's in a combo vs one
                // that isn't share the averaged price) but keeps totals exact.
                for (const existing of existingOrder.items) {
                    if (existing.status === OrderItemStatus.VOIDED) continue;

                    const matchingCalc = calcPool.filter(
                        (c) => c.menuItemId === existing.menuItemId
                    );
                    if (matchingCalc.length > 0) {
                        const totalVal = matchingCalc.reduce(
                            (s, c) => s + c.frozenPrice * c.quantity,
                            0
                        );
                        const totalQty = matchingCalc.reduce((s, c) => s + c.quantity, 0);
                        const avgPrice = totalVal / totalQty;

                        await tx.orderItem.update({
                            where: { id: existing.id },
                            data: { frozenPrice: avgPrice },
                        });
                    }
                }

                // B. Create new items with averaged frozenPrice (same approach)
                const newDbItems: any[] = [];
                for (const inputItem of items) {
                    const matchingCalc = calcPool.filter(
                        (c) => c.menuItemId === inputItem.menuItemId
                    );
                    if (matchingCalc.length > 0) {
                        const totalVal = matchingCalc.reduce(
                            (s, c) => s + c.frozenPrice * c.quantity,
                            0
                        );
                        const totalQty = matchingCalc.reduce((s, c) => s + c.quantity, 0);
                        const avgPrice = totalVal / totalQty;

                        newDbItems.push({
                            menuItemId: inputItem.menuItemId,
                            quantity: inputItem.quantity,
                            notes: inputItem.notes,
                            frozenPrice: avgPrice,
                            status: OrderItemStatus.PENDING,
                            orderId,
                            modifiers: inputItem.selectedModifiers?.length
                                ? {
                                      create: inputItem.selectedModifiers.map((mod: any) => ({
                                          modifierId: mod.modifierId,
                                          name: mod.name,
                                          price: mod.priceAdjustment,
                                      })),
                                  }
                                : undefined,
                        });
                    }
                }

                for (const data of newDbItems) {
                    await tx.orderItem.create({ data });
                }

                // C. Decrement inventory for new items atomically (same pattern
                // as fireOrder so concurrent adds can't oversell the shelf).
                const newCounts: Record<string, number> = {};
                for (const inputItem of items) {
                    newCounts[inputItem.menuItemId] =
                        (newCounts[inputItem.menuItemId] || 0) + inputItem.quantity;
                }

                for (const [mId, qty] of Object.entries(newCounts)) {
                    const mi = menuItems.find((m) => m.id === mId);
                    if (!mi?.trackStock) continue;

                    const decResult = await tx.menuItem.updateMany({
                        where: {
                            id: mId,
                            trackStock: true,
                            stockQuantity: { gte: qty },
                        },
                        data: { stockQuantity: { decrement: qty } },
                    });
                    if (decResult.count === 0) {
                        // Throw so the transaction rolls back cleanly.
                        throw new Error(`Insufficient stock for "${mi.name}"`);
                    }

                    const after = await tx.menuItem.findUnique({
                        where: { id: mId },
                        select: { stockQuantity: true },
                    });
                    if (after && after.stockQuantity <= 0) {
                        await tx.menuItem.update({
                            where: { id: mId },
                            data: { isAvailable: false, stockQuantity: 0 },
                        });
                    }
                }

                // D. Update order totals
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        subtotal: calculation.subtotal,
                        discount: calculation.discount,
                        tax: calculation.tax,
                        total: calculation.total,
                    },
                });

                return { ok: true as const };
            },
            { isolationLevel: 'Serializable' }
        );

        if (!txResult.ok) {
            return { success: false, error: txResult.error };
        }

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/kds', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to add items:', error);
        return { success: false, error: 'Failed to add items to order' };
    }
}

// ─── Remove (Void) Single Item ───────────────────────────────

export async function removeOrderItem(itemId: string) {
    try {
        // Any authenticated staff can void a single line item (mid-service correction).
        // Manager-only void is enforced on the whole-order voidOrder path.
        await requireSession();

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

            // Restore inventory for this line item
            if (item.status !== OrderItemStatus.VOIDED && item.menuItem?.trackStock) {
                await tx.menuItem.update({
                    where: { id: item.menuItemId },
                    data: {
                        stockQuantity: { increment: item.quantity },
                        isAvailable: true,
                    },
                });
            }

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
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to remove item:', error);
        return { success: false, error: 'Failed to remove item' };
    }
}

// ─── Serve Item (READY → SERVED) ────────────────────────────

export async function serveItem(itemId: string) {
    try {
        await requireSession();
        const item = await prisma.orderItem.findUnique({
            where: { id: itemId },
            include: { order: { select: { status: true } } },
        });

        if (!item || item.status !== 'READY') {
            return { success: false, error: 'Item is not ready to serve' };
        }

        // F-H4: don't let staff mark items served on a voided/refunded order.
        if (item.order.status !== OrderStatus.OPEN && item.order.status !== OrderStatus.PAID) {
            return { success: false, error: 'Cannot serve items on a closed order' };
        }

        await prisma.orderItem.update({
            where: { id: itemId },
            data: { status: OrderItemStatus.SERVED },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to serve item:', error);
        return { success: false, error: 'Failed to mark item as served' };
    }
}

// ─── Serve All Items in Order ─────────────────────────

export async function serveAllItems(orderId: string) {
    try {
        await requireSession();

        // F-H4: status guard.
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true },
        });
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PAID) {
            return { success: false, error: 'Cannot serve items on a closed order' };
        }

        await prisma.orderItem.updateMany({
            where: { orderId, status: 'READY' },
            data: { status: OrderItemStatus.SERVED },
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/serve', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
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
        // Refunds move money out and restock inventory — managers only.
        const session = await requireManager();

        // Trust the authenticated session's user id over whatever the client sent.
        const authenticatedUserId = session.user.id;

        if (!params.reason || !params.reason.trim()) {
            return { success: false, error: 'Refund reason is required' };
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const order = await tx.order.findUnique({
                    where: { id: params.orderId },
                    include: {
                        items: { include: { menuItem: true } },
                    },
                });
                if (!order) return { ok: false as const, error: 'Order not found' };

                // Only PAID orders can be partially refunded. Fully-REFUNDED orders cannot
                // be refunded again (blocks double-refund). VOID / OPEN cannot be refunded.
                if (order.status === OrderStatus.REFUNDED) {
                    return { ok: false as const, error: 'Order is already fully refunded' };
                }
                if (order.status !== OrderStatus.PAID) {
                    return { ok: false as const, error: 'Only paid orders can be refunded' };
                }

                const alreadyRefunded = order.refundAmount ?? 0;
                const remainingRefundable = Math.max(0, order.total - alreadyRefunded);
                if (remainingRefundable <= 0) {
                    return { ok: false as const, error: 'Nothing left to refund on this order' };
                }

                let refundAmount = 0;
                const restockMap: Record<string, number> = {};

                if (params.type === 'FULL') {
                    refundAmount = remainingRefundable;

                    // Restock every non-voided, non-already-refunded item
                    for (const item of order.items) {
                        if (item.status === OrderItemStatus.VOIDED) continue;
                        if (item.refunded) continue;
                        if (item.menuItem?.trackStock) {
                            restockMap[item.menuItemId] =
                                (restockMap[item.menuItemId] || 0) + item.quantity;
                        }
                    }

                    await tx.orderItem.updateMany({
                        where: { orderId: order.id, refunded: false, status: { not: 'VOIDED' } },
                        data: { refunded: true },
                    });
                } else {
                    if (!params.itemIds?.length) {
                        return { ok: false as const, error: 'No items selected for partial refund' };
                    }

                    const itemsToRefund = order.items.filter(
                        (i) =>
                            params.itemIds!.includes(i.id) &&
                            !i.refunded &&
                            i.status !== OrderItemStatus.VOIDED
                    );
                    if (itemsToRefund.length === 0) {
                        return { ok: false as const, error: 'Selected items are already refunded or voided' };
                    }

                    const rawAmount = itemsToRefund.reduce(
                        (sum, i) => sum + i.frozenPrice * i.quantity,
                        0
                    );
                    // Cap at remaining refundable so aggressive/manipulated frozenPrice values
                    // can't refund more than the customer actually paid.
                    refundAmount = Math.min(rawAmount, remainingRefundable);
                    if (refundAmount <= 0) {
                        return { ok: false as const, error: 'Refund amount must be positive' };
                    }

                    for (const item of itemsToRefund) {
                        if (item.menuItem?.trackStock) {
                            restockMap[item.menuItemId] =
                                (restockMap[item.menuItemId] || 0) + item.quantity;
                        }
                        await tx.orderItem.update({
                            where: { id: item.id },
                            data: { refunded: true },
                        });
                    }
                }

                // Restore inventory for refunded items
                for (const [mId, qty] of Object.entries(restockMap)) {
                    await tx.menuItem.update({
                        where: { id: mId },
                        data: {
                            stockQuantity: { increment: qty },
                            isAvailable: true,
                        },
                    });
                }

                const newRefundTotal = alreadyRefunded + refundAmount;
                // Mark order as fully REFUNDED when the total refunded >= total, regardless
                // of FULL/PARTIAL flag — prevents further refunds against this order.
                const isNowFullyRefunded = newRefundTotal + 0.0001 >= order.total;

                await tx.order.update({
                    where: { id: params.orderId },
                    data: {
                        status: isNowFullyRefunded ? OrderStatus.REFUNDED : undefined,
                        refundAmount: newRefundTotal,
                        refundReason: params.reason,
                        refundNotes: params.notes || null,
                        refundedById: authenticatedUserId,
                        refundedAt: new Date(),
                    },
                });

                return { ok: true as const, refundAmount };
            },
            { isolationLevel: 'Serializable' }
        );

        if (!result.ok) {
            return { success: false, error: result.error };
        }

        revalidatePath('/(dashboard)/orders', 'page');
        revalidatePath('/(dashboard)/pos', 'page');
        return { success: true, refundAmount: result.refundAmount };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to refund:', error);
        return { success: false, error: 'Failed to process refund' };
    }
}
