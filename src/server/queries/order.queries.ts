'use server';

import { prisma } from '@/lib/prisma';

interface OrderFilters {
    startDate: Date;
    endDate: Date;
    status?: string;
    orderType?: string;
    search?: string;
}

export async function getOrders(filters: OrderFilters) {
    const where: any = {
        createdAt: { gte: filters.startDate, lte: filters.endDate },
    };

    if (filters.status && filters.status !== 'ALL') {
        where.status = filters.status;
    }

    if (filters.orderType && filters.orderType !== 'ALL') {
        where.orderType = filters.orderType;
    }

    if (filters.search) {
        const search = filters.search.trim();
        // Search by order number, table name, or customer name
        const numSearch = parseInt(search, 10);
        where.OR = [
            ...(isNaN(numSearch) ? [] : [{ orderNumber: numSearch }]),
            { customerName: { contains: search, mode: 'insensitive' } },
            { table: { name: { contains: search, mode: 'insensitive' } } },
        ];
    }

    const orders = await prisma.order.findMany({
        where,
        include: {
            table: { select: { name: true } },
            createdBy: { select: { name: true } },
            refundedBy: { select: { name: true } },
            items: {
                include: { menuItem: { select: { name: true, basePrice: true } }, modifiers: true },
                orderBy: { createdAt: 'asc' },
            },
            payments: {
                orderBy: { createdAt: 'asc' },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });

    // Convert Decimal fields to plain numbers for Client Component serialization
    return orders.map(order => ({
        ...order,
        items: order.items.map(item => ({
            ...item,
            modifiers: item.modifiers.map(mod => ({
                ...mod,
                price: Number(mod.price),
            })),
        })),
    }));
}
