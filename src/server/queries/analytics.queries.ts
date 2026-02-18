'use server';

import { prisma } from '@/lib/prisma';

interface AnalyticsParams {
    startDate: Date;
    endDate: Date;
}

export async function getSalesAnalytics({ startDate, endDate }: AnalyticsParams) {
    // Fetch PAID orders with items + menuItem for per-item discount calculation
    const paidOrders = await prisma.order.findMany({
        where: {
            status: 'PAID',
            createdAt: { gte: startDate, lte: endDate },
        },
        include: {
            items: {
                include: {
                    menuItem: {
                        include: { category: true }
                    }
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    const grossSales = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = paidOrders.length;
    const averageTicket = orderCount > 0 ? grossSales / orderCount : 0;

    // ─── Discount: per-item calculation (works retroactively) ─
    // Discount = sum of (basePrice - frozenPrice) × qty for all non-voided items
    let totalDiscount = 0;
    for (const order of paidOrders) {
        for (const item of order.items) {
            if (item.status === 'VOIDED') continue;
            const perItemDiscount = item.menuItem.basePrice - item.frozenPrice;
            if (perItemDiscount > 0) {
                totalDiscount += perItemDiscount * item.quantity;
            }
        }
    }

    // ─── Void Analytics ──────────────────────────────────────
    // Count voided items from ALL orders AND all items from VOID orders
    const allOrdersInPeriod = await prisma.order.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate },
        },
        include: {
            items: {
                include: { menuItem: true },
            },
        },
    });

    let voidedItemCount = 0;
    let voidedItemValue = 0;
    for (const order of allOrdersInPeriod) {
        if (order.status === 'VOID') {
            // Entire order voided — count all items
            for (const item of order.items) {
                voidedItemCount += item.quantity;
                voidedItemValue += item.menuItem.basePrice * item.quantity;
            }
        } else {
            // Individual voided items within non-void orders
            for (const item of order.items) {
                if (item.status === 'VOIDED') {
                    voidedItemCount += item.quantity;
                    voidedItemValue += item.menuItem.basePrice * item.quantity;
                }
            }
        }
    }

    // Hourly breakdown (for Today) or Daily breakdown (for 7d/30d)
    // We decide usage based on the time range duration
    const durationMs = endDate.getTime() - startDate.getTime();
    const isToday = durationMs <= 86400000; // approx 24 hours

    const trendMap = new Map<string, { label: string; date: string; revenue: number; count: number }>();

    // Initialize trend map to ensure continuous x-axis
    if (isToday) {
        for (let i = 0; i < 24; i++) {
            const label = i.toString().padStart(2, '0') + ':00';
            trendMap.set(i.toString(), { label, date: i.toString(), revenue: 0, count: 0 });
        }
    } else {
        const d = new Date(startDate);
        while (d <= endDate) {
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            trendMap.set(key, { label, date: key, revenue: 0, count: 0 });
            d.setDate(d.getDate() + 1);
        }
    }

    for (const order of paidOrders) {
        let key = '';
        if (isToday) {
            key = order.createdAt.getHours().toString();
        } else {
            key = order.createdAt.toISOString().split('T')[0];
        }

        const existing = trendMap.get(key);
        if (existing) {
            existing.revenue += order.total;
            existing.count += 1;
        }
    }

    const salesTrend = Array.from(trendMap.values()); // Already sorted if we inserted in order, but map iter order is insertion order

    // Top selling items (exclude voided) AND Category Sales
    const itemCountMap = new Map<string, { name: string; count: number; revenue: number }>();
    const categorySalesMap = new Map<string, { name: string; value: number }>();

    for (const order of paidOrders) {
        for (const item of order.items) {
            if (item.status === 'VOIDED') continue;

            // Item Stats
            const existingItem = itemCountMap.get(item.menuItemId) ?? {
                name: item.menuItem.name,
                count: 0,
                revenue: 0,
            };
            itemCountMap.set(item.menuItemId, {
                name: existingItem.name,
                count: existingItem.count + item.quantity,
                revenue: existingItem.revenue + item.frozenPrice * item.quantity,
            });

            // Category Stats
            const catName = item.menuItem.category?.name || 'Uncategorized';
            const existingCat = categorySalesMap.get(catName) ?? { name: catName, value: 0 };
            categorySalesMap.set(catName, {
                name: catName,
                value: existingCat.value + item.frozenPrice * item.quantity
            });
        }
    }

    const topItems = Array.from(itemCountMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    const categorySales = Array.from(categorySalesMap.values()).sort((a, b) => b.value - a.value);

    // Order Type Breakdown
    const orderTypeMap = new Map<string, { name: string; value: number; count: number }>();
    for (const order of paidOrders) {
        const type = order.orderType.replace('_', ' '); // DINE_IN -> DINE IN
        const existing = orderTypeMap.get(type) ?? { name: type, value: 0, count: 0 };
        orderTypeMap.set(type, {
            name: type,
            value: existing.value + order.total,
            count: existing.count + 1
        });
    }

    const orderTypeBreakdown = Array.from(orderTypeMap.values());

    // Payment method breakdown
    const cashOrders = paidOrders.filter((o) => o.paymentMethod === 'CASH');
    const cardOrders = paidOrders.filter((o) => o.paymentMethod === 'CARD_EXTERNAL');

    // Refund metrics
    const refundedOrders = await prisma.order.findMany({
        where: {
            status: 'REFUNDED',
            createdAt: { gte: startDate, lte: endDate },
        },
    });
    const totalRefunds = refundedOrders.reduce((sum, o) => sum + (o.refundAmount ?? 0), 0);

    const totalTax = paidOrders.reduce((sum, o) => sum + (o.tax || 0), 0);

    return {
        grossSales,
        orderCount,
        averageTicket,
        totalDiscount,
        totalTax,
        voidedItemCount,
        voidedItemValue,
        totalRefunds,
        refundCount: refundedOrders.length,
        salesTrend,
        categorySales,
        orderTypeBreakdown,
        topItems,
        paymentBreakdown: {
            cash: { count: cashOrders.length, total: cashOrders.reduce((s, o) => s + o.total, 0) },
            card: { count: cardOrders.length, total: cardOrders.reduce((s, o) => s + o.total, 0) },
        },
    };
}
