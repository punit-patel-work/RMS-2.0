'use server';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

interface OrderFilters {
    startDate: Date;
    endDate: Date;
    status?: string;
    orderType?: string;
    search?: string;
    /** P-C2: optional pagination — defaults still cap at MAX_TAKE for safety. */
    take?: number;
    skip?: number;
}

// P-C2: previous default of 200 was load-bearing for "show me everything"
// pages but routinely fetched a few thousand line items + modifiers per
// page render. Cut the default in half; callers that genuinely want more
// can pass `take` explicitly.
const DEFAULT_TAKE = 100;
const MAX_TAKE = 200;

export async function getOrders(filters: OrderFilters) {
    const where: Prisma.OrderWhereInput = {
        createdAt: { gte: filters.startDate, lte: filters.endDate },
    };

    if (filters.status && filters.status !== 'ALL') {
        where.status = filters.status as Prisma.OrderWhereInput['status'];
    }

    if (filters.orderType && filters.orderType !== 'ALL') {
        where.orderType = filters.orderType as Prisma.OrderWhereInput['orderType'];
    }

    if (filters.search) {
        const search = filters.search.trim();
        const numSearch = parseInt(search, 10);
        where.OR = [
            ...(isNaN(numSearch) ? [] : [{ orderNumber: numSearch }]),
            { customerName: { contains: search, mode: 'insensitive' } },
            { table: { name: { contains: search, mode: 'insensitive' } } },
        ];
    }

    const take = Math.min(MAX_TAKE, Math.max(1, filters.take ?? DEFAULT_TAKE));
    const skip = Math.max(0, filters.skip ?? 0);

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
        take,
        skip,
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
