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

        return { success: true, pointsBalance: updated.pointsBalance };
    } catch (error) {
        console.error('Failed to update points:', error);
        return { success: false, error: 'Failed to update points' };
    }
}
