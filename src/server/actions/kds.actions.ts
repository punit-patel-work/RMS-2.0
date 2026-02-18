'use server';

import { prisma } from '@/lib/prisma';
import { OrderItemStatus, OrderStatus, OrderType } from '@/generated/prisma/client';

export async function getSidebarCounts() {
    try {
        const [pendingCount, readyCount] = await Promise.all([
            prisma.orderItem.count({
                where: {
                    status: OrderItemStatus.PENDING,
                    order: {
                        status: { in: [OrderStatus.OPEN, OrderStatus.PAID] },
                        orderType: { not: OrderType.QUICK_SALE }
                    }
                },
            }),
            prisma.orderItem.count({
                where: {
                    status: OrderItemStatus.READY,
                    order: {
                        status: { in: [OrderStatus.OPEN, OrderStatus.PAID] },
                        orderType: { not: OrderType.QUICK_SALE }
                    }
                },
            }),
        ]);
        return { pending: pendingCount, ready: readyCount };
    } catch (error) {
        console.error('Failed to fetch sidebar counts:', error);
        return { pending: 0, ready: 0 };
    }
}
