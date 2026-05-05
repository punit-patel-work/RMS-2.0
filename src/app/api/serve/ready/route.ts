import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        // Two reasons an order belongs on the serve board:
        //   (a) It still has READY items waiting for floor staff to deliver.
        //   (b) It's a LATER_PAY ticket that hasn't been collected yet — i.e.
        //       still OPEN. Once the takeout customer pays, the order flips to
        //       PAID and we MUST stop showing the "Collect Payment" button,
        //       otherwise staff repeatedly tries to charge a fully-paid ticket.
        const orders = await prisma.order.findMany({
            where: {
                status: { in: ['OPEN', 'PAID'] },
                orderType: { not: 'QUICK_SALE' },
                OR: [
                    { items: { some: { status: 'READY' } } },
                    { AND: [{ status: 'OPEN' }, { paymentMethod: 'LATER_PAY' }] },
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
