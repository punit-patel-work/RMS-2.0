'use server';

import { prisma } from '@/lib/prisma';

interface AnalyticsParams {
    startDate: Date;
    endDate: Date;
}

/**
 * Comprehensive sales analytics. One DB hit pulls every order in the period
 * (incl. items, modifiers, customer, table, createdBy); everything else is
 * computed in memory. The shape is intentionally large so the dashboard can
 * render multiple panels without re-querying.
 */
export async function getSalesAnalytics({ startDate, endDate }: AnalyticsParams) {
    // ─── Pull current period + prior period in parallel ─────────
    // Prior period = same length immediately before startDate. This lets the UI
    // show "vs last period" deltas on every KPI without separate fetches.
    const periodMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodMs);

    const [allOrders, prevOrders, lowStockItems, customerCount] = await Promise.all([
        prisma.order.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            include: {
                items: { include: { menuItem: { include: { category: true } } } },
                createdBy: { select: { id: true, name: true, role: true } },
                customer: { select: { id: true, name: true, phone: true } },
                table: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.order.findMany({
            where: { createdAt: { gte: prevStart, lte: prevEnd }, status: 'PAID' },
            select: { total: true, createdAt: true },
        }),
        prisma.menuItem.findMany({
            where: { trackStock: true, stockQuantity: { lte: 10 } },
            select: { id: true, name: true, stockQuantity: true, isAvailable: true, category: { select: { name: true } } },
            orderBy: { stockQuantity: 'asc' },
            take: 15,
        }),
        prisma.customer.count(),
    ]);

    const paidOrders = allOrders.filter((o) => o.status === 'PAID');
    const refundedOrders = allOrders.filter((o) => o.status === 'REFUNDED');
    const voidOrders = allOrders.filter((o) => o.status === 'VOID');

    // ─── Headline metrics ──────────────────────────────────────
    const grossSales = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = paidOrders.length;
    const averageTicket = orderCount > 0 ? grossSales / orderCount : 0;
    const totalTax = paidOrders.reduce((sum, o) => sum + (o.tax || 0), 0);

    let totalDiscount = 0;
    for (const order of paidOrders) {
        for (const item of order.items) {
            if (item.status === 'VOIDED') continue;
            const perItemDiscount = item.menuItem.basePrice - item.frozenPrice;
            if (perItemDiscount > 0) totalDiscount += perItemDiscount * item.quantity;
        }
    }

    // ─── Prior-period totals for delta arrows ─────────────────
    const prevGross = prevOrders.reduce((s, o) => s + o.total, 0);
    const prevCount = prevOrders.length;
    const prevAvg = prevCount > 0 ? prevGross / prevCount : 0;
    const pctChange = (curr: number, prev: number): number | null => {
        if (prev === 0) return curr === 0 ? 0 : null; // null = "no prior data"
        return ((curr - prev) / prev) * 100;
    };

    // ─── Voids ────────────────────────────────────────────────
    let voidedItemCount = 0;
    let voidedItemValue = 0;
    for (const order of allOrders) {
        if (order.status === 'VOID') {
            for (const item of order.items) {
                voidedItemCount += item.quantity;
                voidedItemValue += item.menuItem.basePrice * item.quantity;
            }
        } else {
            for (const item of order.items) {
                if (item.status === 'VOIDED') {
                    voidedItemCount += item.quantity;
                    voidedItemValue += item.menuItem.basePrice * item.quantity;
                }
            }
        }
    }

    // ─── Sales trend (hourly for today, daily for multi-day) ──
    const isToday = periodMs <= 86400000;
    const trendMap = new Map<string, { label: string; date: string; revenue: number; count: number }>();
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
        const key = isToday
            ? order.createdAt.getHours().toString()
            : order.createdAt.toISOString().split('T')[0];
        const existing = trendMap.get(key);
        if (existing) {
            existing.revenue += order.total;
            existing.count += 1;
        }
    }
    const salesTrend = Array.from(trendMap.values());

    // ─── Top items / categories ───────────────────────────────
    const itemCountMap = new Map<string, { name: string; count: number; revenue: number; categoryName: string }>();
    const categorySalesMap = new Map<string, { name: string; value: number; itemCount: number }>();

    for (const order of paidOrders) {
        for (const item of order.items) {
            if (item.status === 'VOIDED') continue;
            const catName = item.menuItem.category?.name || 'Uncategorized';

            const existingItem = itemCountMap.get(item.menuItemId) ?? {
                name: item.menuItem.name, count: 0, revenue: 0, categoryName: catName,
            };
            itemCountMap.set(item.menuItemId, {
                ...existingItem,
                count: existingItem.count + item.quantity,
                revenue: existingItem.revenue + item.frozenPrice * item.quantity,
            });

            const existingCat = categorySalesMap.get(catName) ?? { name: catName, value: 0, itemCount: 0 };
            categorySalesMap.set(catName, {
                name: catName,
                value: existingCat.value + item.frozenPrice * item.quantity,
                itemCount: existingCat.itemCount + item.quantity,
            });
        }
    }

    const sortedItems = Array.from(itemCountMap.values()).sort((a, b) => b.revenue - a.revenue);
    const topItems = sortedItems.slice(0, 10);
    const slowItems = [...sortedItems].sort((a, b) => a.count - b.count).slice(0, 5);
    const categorySales = Array.from(categorySalesMap.values()).sort((a, b) => b.value - a.value);

    // ─── Order type + payment breakdowns ──────────────────────
    const orderTypeMap = new Map<string, { name: string; value: number; count: number }>();
    for (const order of paidOrders) {
        const type = order.orderType.replace('_', ' ');
        const existing = orderTypeMap.get(type) ?? { name: type, value: 0, count: 0 };
        orderTypeMap.set(type, {
            name: type,
            value: existing.value + order.total,
            count: existing.count + 1,
        });
    }
    const orderTypeBreakdown = Array.from(orderTypeMap.values());

    const cashOrders = paidOrders.filter((o) => o.paymentMethod === 'CASH');
    const cardOrders = paidOrders.filter((o) => o.paymentMethod === 'CARD_EXTERNAL');

    // ─── Staff leaderboard ────────────────────────────────────
    const staffMap = new Map<string, { id: string; name: string; role: string; revenue: number; orders: number; avgTicket: number }>();
    for (const order of paidOrders) {
        if (!order.createdBy) continue;
        const cur = staffMap.get(order.createdBy.id) ?? {
            id: order.createdBy.id,
            name: order.createdBy.name,
            role: order.createdBy.role,
            revenue: 0,
            orders: 0,
            avgTicket: 0,
        };
        cur.revenue += order.total;
        cur.orders += 1;
        cur.avgTicket = cur.revenue / cur.orders;
        staffMap.set(order.createdBy.id, cur);
    }
    const staffLeaderboard = Array.from(staffMap.values()).sort((a, b) => b.revenue - a.revenue);

    // ─── Hour × day-of-week heatmap (for any period) ─────────
    // 7 days × 24 hours = 168 cells. Each cell holds revenue total.
    const heatmap: { day: number; hour: number; revenue: number; count: number }[] = [];
    const heatmapMap = new Map<string, { day: number; hour: number; revenue: number; count: number }>();
    for (const order of paidOrders) {
        const day = order.createdAt.getDay();   // 0 = Sun
        const hour = order.createdAt.getHours();
        const key = `${day}-${hour}`;
        const cur = heatmapMap.get(key) ?? { day, hour, revenue: 0, count: 0 };
        cur.revenue += order.total;
        cur.count += 1;
        heatmapMap.set(key, cur);
    }
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            heatmap.push(heatmapMap.get(`${d}-${h}`) ?? { day: d, hour: h, revenue: 0, count: 0 });
        }
    }
    // Find peak hour and busiest day-of-week
    const peakHourCell = heatmap.reduce((max, c) => (c.revenue > max.revenue ? c : max), heatmap[0]);
    const dayTotals = new Map<number, number>();
    for (const c of heatmap) dayTotals.set(c.day, (dayTotals.get(c.day) ?? 0) + c.revenue);
    const busiestDayEntry = Array.from(dayTotals.entries()).sort((a, b) => b[1] - a[1])[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // ─── Customer metrics ─────────────────────────────────────
    const customerOrderMap = new Map<string, { id: string; name: string | null; phone: string; orderCount: number; totalSpent: number }>();
    let attachedOrders = 0;
    for (const order of paidOrders) {
        if (!order.customer) continue;
        attachedOrders += 1;
        const cur = customerOrderMap.get(order.customer.id) ?? {
            id: order.customer.id,
            name: order.customer.name,
            phone: order.customer.phone,
            orderCount: 0,
            totalSpent: 0,
        };
        cur.orderCount += 1;
        cur.totalSpent += order.total;
        customerOrderMap.set(order.customer.id, cur);
    }
    const topCustomers = Array.from(customerOrderMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
    const repeatCustomerCount = Array.from(customerOrderMap.values()).filter((c) => c.orderCount > 1).length;
    const totalPointsRedeemed = paidOrders.reduce((s, o) => s + (o.pointsRedeemed ?? 0), 0);

    // ─── Operational efficiency ───────────────────────────────
    // Average time from order created → first served item (proxy for kitchen + serve)
    let totalServeMs = 0;
    let servedSampleCount = 0;
    for (const order of paidOrders) {
        const servedTimes = order.items
            .filter((i) => i.status === 'SERVED')
            .map((i) => i.updatedAt.getTime());
        if (servedTimes.length === 0) continue;
        const lastServed = Math.max(...servedTimes);
        totalServeMs += lastServed - order.createdAt.getTime();
        servedSampleCount += 1;
    }
    const avgFulfillmentMin = servedSampleCount > 0 ? totalServeMs / servedSampleCount / 60000 : null;

    // Refund + void rates as percentages of total period orders
    const totalPeriodOrders = allOrders.length;
    const refundRate = totalPeriodOrders > 0 ? (refundedOrders.length / totalPeriodOrders) * 100 : 0;
    const voidRate = totalPeriodOrders > 0 ? (voidOrders.length / totalPeriodOrders) * 100 : 0;
    const totalRefunds = refundedOrders.reduce((s, o) => s + (o.refundAmount ?? 0), 0);

    // Discount rate as % of gross
    const baseTotal = paidOrders.reduce((sum, o) => {
        return sum + o.items.reduce((s, i) => s + (i.status === 'VOIDED' ? 0 : i.menuItem.basePrice * i.quantity), 0);
    }, 0);
    const discountRate = baseTotal > 0 ? (totalDiscount / baseTotal) * 100 : 0;

    // ─── Auto-generated insights (narrative callouts) ────────
    const insights: { kind: 'positive' | 'negative' | 'neutral'; title: string; detail: string }[] = [];
    const grossDelta = pctChange(grossSales, prevGross);
    if (grossDelta !== null && Math.abs(grossDelta) >= 5) {
        insights.push({
            kind: grossDelta > 0 ? 'positive' : 'negative',
            title: `Revenue ${grossDelta > 0 ? 'up' : 'down'} ${Math.abs(grossDelta).toFixed(1)}%`,
            detail: `${formatCompactCurrency(grossSales)} this period vs ${formatCompactCurrency(prevGross)} last period`,
        });
    }
    if (peakHourCell && peakHourCell.revenue > 0) {
        const hour12 = ((peakHourCell.hour + 11) % 12) + 1;
        const ampm = peakHourCell.hour >= 12 ? 'PM' : 'AM';
        insights.push({
            kind: 'neutral',
            title: `Peak hour: ${dayNames[peakHourCell.day]} ${hour12}${ampm}`,
            detail: `${formatCompactCurrency(peakHourCell.revenue)} across ${peakHourCell.count} orders`,
        });
    }
    if (busiestDayEntry && busiestDayEntry[1] > 0) {
        insights.push({
            kind: 'neutral',
            title: `Busiest day: ${dayNames[busiestDayEntry[0]]}`,
            detail: `${formatCompactCurrency(busiestDayEntry[1])} total in this period`,
        });
    }
    if (lowStockItems.length > 0) {
        insights.push({
            kind: 'negative',
            title: `${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} low on stock`,
            detail: lowStockItems.slice(0, 3).map((i) => `${i.name} (${i.stockQuantity})`).join(', '),
        });
    }
    if (refundRate > 5) {
        insights.push({
            kind: 'negative',
            title: `Refund rate ${refundRate.toFixed(1)}%`,
            detail: `${refundedOrders.length} refunded of ${totalPeriodOrders} orders — investigate cause`,
        });
    }
    if (topItems.length > 0) {
        insights.push({
            kind: 'positive',
            title: `Top seller: ${topItems[0].name}`,
            detail: `${topItems[0].count} sold for ${formatCompactCurrency(topItems[0].revenue)}`,
        });
    }
    if (staffLeaderboard.length > 0 && staffLeaderboard[0].orders >= 5) {
        insights.push({
            kind: 'positive',
            title: `Top server: ${staffLeaderboard[0].name}`,
            detail: `${staffLeaderboard[0].orders} orders, avg ${formatCompactCurrency(staffLeaderboard[0].avgTicket)} ticket`,
        });
    }
    if (slowItems.length > 0 && topItems.length > 0 && slowItems[0].count <= 1) {
        insights.push({
            kind: 'neutral',
            title: `Slow mover: ${slowItems[0].name}`,
            detail: `Only ${slowItems[0].count} sold — consider menu engineering`,
        });
    }
    if (totalPointsRedeemed > 0) {
        insights.push({
            kind: 'neutral',
            title: `${totalPointsRedeemed} loyalty points redeemed`,
            detail: `${repeatCustomerCount} customers placed multiple orders this period`,
        });
    }

    // ─── Net revenue (true take-home) ──────────────────────────
    // Gross minus refunds minus the value of voided items. This is what
    // actually hit the till after corrections.
    const netRevenue = grossSales - totalRefunds - voidedItemValue;

    // ─── Items per order ───────────────────────────────────────
    let totalLineItems = 0;
    for (const o of paidOrders) {
        for (const i of o.items) {
            if (i.status !== 'VOIDED') totalLineItems += i.quantity;
        }
    }
    const itemsPerOrder = orderCount > 0 ? totalLineItems / orderCount : 0;

    // Sparklines for hero KPIs — re-using the salesTrend buckets so they
    // share an x-axis with the main chart. Each KPI gets the array of values
    // it cares about.
    const sparklineRevenue = salesTrend.map((p) => p.revenue);
    const sparklineOrders = salesTrend.map((p) => p.count);
    const sparklineAvg = salesTrend.map((p) => (p.count > 0 ? p.revenue / p.count : 0));

    return {
        // headline KPIs with deltas
        grossSales,
        netRevenue,
        orderCount,
        averageTicket,
        itemsPerOrder,
        totalDiscount,
        totalTax,
        voidedItemCount,
        voidedItemValue,
        totalRefunds,
        refundCount: refundedOrders.length,
        refundRate,
        voidRate,
        discountRate,
        // delta vs prior period
        deltas: {
            grossSales: pctChange(grossSales, prevGross),
            orderCount: pctChange(orderCount, prevCount),
            averageTicket: pctChange(averageTicket, prevAvg),
            netRevenue: pctChange(netRevenue, prevGross),
        },
        // sparklines for KPI inline trend
        sparklines: {
            revenue: sparklineRevenue,
            orders: sparklineOrders,
            avgTicket: sparklineAvg,
        },
        // existing chart data
        salesTrend,
        categorySales,
        orderTypeBreakdown,
        topItems,
        slowItems,
        paymentBreakdown: {
            cash: { count: cashOrders.length, total: cashOrders.reduce((s, o) => s + o.total, 0) },
            card: { count: cardOrders.length, total: cardOrders.reduce((s, o) => s + o.total, 0) },
        },
        // new sections
        staffLeaderboard,
        heatmap,
        customers: {
            total: customerCount,
            attachedOrders,
            attachRate: paidOrders.length > 0 ? (attachedOrders / paidOrders.length) * 100 : 0,
            repeatCount: repeatCustomerCount,
            top: topCustomers,
            pointsRedeemed: totalPointsRedeemed,
        },
        operations: {
            avgFulfillmentMin,
            servedSampleCount,
        },
        lowStockItems,
        insights,
    };
}

// Helper for narrative insight strings — always rounded to nearest dollar.
function formatCompactCurrency(n: number): string {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
}
