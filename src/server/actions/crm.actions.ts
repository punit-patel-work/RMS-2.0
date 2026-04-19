'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function registerCustomer(phone: string, name?: string) {
    try {
        const existing = await prisma.customer.findUnique({
            where: { phone }
        });

        if (existing) {
            return { success: false, error: 'A customer with this phone number already exists' };
        }

        const customer = await prisma.customer.create({
            data: {
                phone,
                name,
                pointsBalance: 0,
            }
        });

        return { success: true, customer };
    } catch (error) {
        console.error('Failed to register customer:', error);
        return { success: false, error: 'Failed to create customer' };
    }
}

export async function verifyCustomer(phone: string) {
    try {
        const customer = await prisma.customer.findUnique({
            where: { phone }
        });

        if (!customer) {
            return { success: false, error: 'Customer not found' };
        }

        return { success: true, customer };
    } catch (error) {
        console.error('Failed to verify customer:', error);
        return { success: false, error: 'Customer lookup failed' };
    }
}

export async function updateCustomerPoints(customerId: string, pointsDelta: number) {
    try {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) return { success: false, error: 'Customer not found' };

        const newBalance = Math.max(0, customer.pointsBalance + pointsDelta);

        const updated = await prisma.customer.update({
            where: { id: customerId },
            data: { pointsBalance: newBalance }
        });

        revalidatePath('/(dashboard)/pos', 'page');
        revalidatePath('/(dashboard)/takeout', 'page');
        revalidatePath('/(dashboard)/admin/customers', 'page');

        return { success: true, pointsBalance: updated.pointsBalance };
    } catch (error) {
        console.error('Failed to update points:', error);
        return { success: false, error: 'Failed to update points' };
    }
}

export async function getCustomers(search?: string) {
    try {
        const where = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } }
            ]
        } : {};

        const customers = await prisma.customer.findMany({
            where,
            include: {
                _count: {
                    select: { orders: true }
                },
                // Only fetch the MOST RECENT order to get the lastOrderDate
                orders: {
                    select: { createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Fast aggregation of lifetime values for these customers
        const customerIds = customers.map(c => c.id);
        const lifetimeAggregates = await prisma.order.groupBy({
            by: ['customerId'],
            where: {
                customerId: { in: customerIds },
                status: 'PAID'
            },
            _sum: {
                amountPaid: true
            }
        });

        const lifetimeMap = new Map(
            lifetimeAggregates.map(agg => [agg.customerId, agg._sum.amountPaid || 0])
        );

        return customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            pointsBalance: c.pointsBalance,
            createdAt: c.createdAt,
            orderCount: c._count.orders,
            lifetimeValue: lifetimeMap.get(c.id) || 0,
            lastOrderDate: c.orders[0]?.createdAt || null
        }));
    } catch (error) {
        console.error('Failed to get customers:', error);
        return [];
    }
}

export async function getCustomerDetails(customerId: string) {
     try {
         const customer = await prisma.customer.findUnique({
             where: { id: customerId },
             include: {
                 orders: {
                     orderBy: { createdAt: 'desc' },
                     include: {
                         items: {
                             include: { menuItem: { select: { name: true } } }
                         }
                     }
                 }
             }
         });
         return customer;
     } catch (error) {
         console.error('Failed to get customer details:', error);
         return null;
     }
}
