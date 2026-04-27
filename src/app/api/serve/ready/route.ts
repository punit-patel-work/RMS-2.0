import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        // Orders with READY items OR LATER_PAY orders still OPEN (for payment collection)
        const orders = await prisma.order.findMany({
            where: {
                status: { in: ['OPEN', 'PAID'] },
                OR: [
                    { items: { some: { status: 'READY' } } },
                    { paymentMethod: 'LATER_PAY' },
                ],
                orderType: {
                    not: 'QUICK_SALE',
                },
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
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json({ orders });
    } catch (error) {
        console.error('Serve fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}
