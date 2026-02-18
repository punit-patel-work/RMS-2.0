import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Fetch prep buffer setting (default 30 mins)
        const settings = await prisma.siteSettings.findUnique({
            where: { key: 'KITCHEN_PREP_BUFFER_MINUTES' },
        });
        const bufferMinutes = parseInt(settings?.value || '30');

        // Calculate cutoff time: Now + Buffer
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() + bufferMinutes);

        const orders = await prisma.order.findMany({
            where: {
                status: { in: ['OPEN', 'PAID'] },
                items: {
                    some: { status: 'PENDING' },
                },
                orderType: {
                    not: 'QUICK_SALE',
                },
                OR: [
                    { scheduledAt: null }, // ASAP orders always show
                    { scheduledAt: { lte: cutoffTime } }, // Scheduled within buffer window
                ],
            },
            include: {
                table: true,
                items: {
                    include: { menuItem: true },
                    orderBy: { createdAt: 'asc' },
                },
                createdBy: {
                    select: { name: true },
                },
            },
            orderBy: [
                { scheduledAt: 'asc' }, // Scheduled first
                { createdAt: 'asc' },   // Then by creation time
            ],
        });

        return NextResponse.json({ orders });
    } catch (error) {
        console.error('KDS fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}
