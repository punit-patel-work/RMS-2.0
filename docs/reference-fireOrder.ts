// ────────────────────────────────────────────────────────────
// REFERENCE IMPLEMENTATION — provided by user for guidance
// This will be used as the basis for the actual server action
// during Step 6 (POS Cart & Order Builder) of the plan.
// ────────────────────────────────────────────────────────────

'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { OrderStatus, TableStatus, OrderItemStatus } from '@/generated/prisma/client';

// 1. Input Validation Schema
const createOrderSchema = z.object({
  tableId: z.string().min(1, "Table ID is required"),
  userId: z.string().min(1, "User ID is required"),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    })
  ).min(1, "Order must have at least one item"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export async function fireOrder(input: CreateOrderInput) {
  const result = createOrderSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: "Invalid form data" };
  }
  const { tableId, items, userId } = result.data;

  try {
    // Fetch data needed for pricing (parallel)
    const [menuItems, activePromotions] = await Promise.all([
      prisma.menuItem.findMany({
        where: { id: { in: items.map((i) => i.menuItemId) } },
        include: { category: true },
      }),
      prisma.promotion.findMany({
        where: { active: true },
      }),
    ]);

    // Calculate "Frozen Prices"
    const orderItemsData = items.map((requestItem) => {
      const dbItem = menuItems.find((i) => i.id === requestItem.menuItemId);
      if (!dbItem) {
        throw new Error(`Menu item ${requestItem.menuItemId} not found`);
      }

      const applicablePromo = activePromotions.find(
        (p) =>
          (p.scope === 'ITEM' && p.menuItemId === dbItem.id) ||
          (p.scope === 'CATEGORY' && p.categoryId === dbItem.categoryId)
      );

      let frozenPrice = dbItem.basePrice;

      if (applicablePromo) {
        if (applicablePromo.type === 'FIXED') {
          frozenPrice = Math.max(0, dbItem.basePrice - applicablePromo.value);
        } else if (applicablePromo.type === 'PERCENT') {
          const discount = dbItem.basePrice * (applicablePromo.value / 100);
          frozenPrice = Math.max(0, dbItem.basePrice - discount);
        }
      }

      return {
        menuItemId: dbItem.id,
        quantity: requestItem.quantity,
        notes: requestItem.notes,
        frozenPrice,
        status: OrderItemStatus.PENDING,
      };
    });

    const subtotal = orderItemsData.reduce(
      (acc, item) => acc + item.frozenPrice * item.quantity,
      0
    );

    // Transaction (All or Nothing)
    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tableId,
          createdById: userId,
          status: OrderStatus.OPEN,
          subtotal,
          total: subtotal,
          items: { create: orderItemsData },
        },
      });

      await tx.table.update({
        where: { id: tableId },
        data: {
          status: TableStatus.OCCUPIED,
          currentOrderId: order.id,
        },
      });

      return order;
    });

    revalidatePath('/(dashboard)/pos', 'page');
    revalidatePath('/(dashboard)/kds', 'page');

    return { success: true, orderId: newOrder.id };
  } catch (error) {
    console.error("Failed to fire order:", error);
    return { success: false, error: "Failed to create order. Please try again." };
  }
}
