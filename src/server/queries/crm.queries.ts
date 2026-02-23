'use server';

import { prisma } from '@/lib/prisma';

export async function getMarketingDashboardStats() {
    // Basic CRM Counts
    const totalCustomers = await prisma.customer.count();

    // Total Liabilities (Points)
    const pointsData = await prisma.customer.aggregate({
        _sum: { pointsBalance: true }
    });
    const totalPoints = pointsData._sum.pointsBalance || 0;

    // Segmentation
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const activeCount = await prisma.customer.count({
        where: {
            orders: { some: { createdAt: { gte: thirtyDaysAgo } } }
        }
    });

    const atRiskCount = await prisma.customer.count({
        where: {
            orders: { none: { createdAt: { gte: sixtyDaysAgo } } }
        }
    });

    // High Value VIPS
    const vips = await prisma.customer.findMany({
        orderBy: { pointsBalance: 'desc' },
        take: 5,
        include: {
            _count: { select: { orders: true } }
        }
    });

    return {
        totalCustomers,
        totalPoints,
        activeCount,
        atRiskCount,
        vips
    };
}
