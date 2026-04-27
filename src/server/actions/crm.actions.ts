'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AuthError, requireManager, requireRole } from '@/lib/auth-helpers';
import { z } from 'zod';

// E.164-ish: digits, optional leading +, 7–15 digits.
const phoneSchema = z
    .string()
    .trim()
    .regex(/^\+?\d{7,15}$/, 'Phone must be 7–15 digits (optional leading +)');

const nameSchema = z.string().trim().min(1).max(100).optional();

function normalizePhone(raw: string): string {
    return raw.trim().replace(/[\s\-()]/g, '');
}

// Customer-facing; intentionally reachable from the public storefront.
// Adds format + length validation to prevent whitespace-only registrations
// from colliding with the unique constraint.
export async function registerCustomer(phone: string, name?: string) {
    try {
        const cleanedPhone = phoneSchema.parse(normalizePhone(phone));
        const cleanedName = nameSchema.parse(name);

        const existing = await prisma.customer.findUnique({
            where: { phone: cleanedPhone },
        });

        if (existing) {
            return { success: false, error: 'A customer with this phone number already exists' };
        }

        const customer = await prisma.customer.create({
            data: {
                phone: cleanedPhone,
                name: cleanedName,
                pointsBalance: 0,
            },
        });

        return { success: true, customer };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0]?.message ?? 'Invalid input' };
        }
        console.error('Failed to register customer:', error);
        return { success: false, error: 'Failed to create customer' };
    }
}

export async function verifyCustomer(phone: string) {
    try {
        const cleanedPhone = phoneSchema.parse(normalizePhone(phone));
        const customer = await prisma.customer.findUnique({
            where: { phone: cleanedPhone },
        });

        if (!customer) {
            return { success: false, error: 'Customer not found' };
        }

        return { success: true, customer };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0]?.message ?? 'Invalid phone' };
        }
        console.error('Failed to verify customer:', error);
        return { success: false, error: 'Customer lookup failed' };
    }
}

export async function updateCustomerPoints(customerId: string, pointsDelta: number) {
    try {
        // Any manager can credit/debit points, but not kitchen staff.
        await requireManager();

        if (!Number.isFinite(pointsDelta) || Math.abs(pointsDelta) > 100_000) {
            return { success: false, error: 'Invalid points delta' };
        }

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
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error('Failed to update points:', error);
        return { success: false, error: 'Failed to update points' };
    }
}

export async function getCustomers(search?: string) {
    try {
        // CRM data is sensitive PII — block kitchen staff entirely.
        await requireRole(['OWNER', 'SUPERVISOR', 'FLOOR_STAFF']);

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
        if (error instanceof AuthError) return [];
        console.error('Failed to get customers:', error);
        return [];
    }
}

export async function getCustomerDetails(customerId: string) {
     try {
         await requireRole(['OWNER', 'SUPERVISOR', 'FLOOR_STAFF']);

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
         if (error instanceof AuthError) return null;
         console.error('Failed to get customer details:', error);
         return null;
     }
}
