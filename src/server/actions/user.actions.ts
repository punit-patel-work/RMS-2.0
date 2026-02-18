'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import type { Role } from '@/generated/prisma/client';

export async function createUser(
    name: string,
    role: Role,
    pin: string
) {
    try {
        const hashedPin = await hash(pin, 10);
        await prisma.user.create({
            data: { name, role, pinCode: hashedPin },
        });
        revalidatePath('/(dashboard)/admin/users', 'page');
        return { success: true };
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return { success: false, error: 'PIN already in use' };
        }
        console.error('Failed to create user:', error);
        return { success: false, error: 'Failed to create user' };
    }
}

export async function updateUser(
    userId: string,
    data: { name?: string; role?: Role; pin?: string }
) {
    try {
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.role) updateData.role = data.role;
        if (data.pin) updateData.pinCode = await hash(data.pin, 10);

        await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
        revalidatePath('/(dashboard)/admin/users', 'page');
        return { success: true };
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return { success: false, error: 'PIN already in use' };
        }
        console.error('Failed to update user:', error);
        return { success: false, error: 'Failed to update user' };
    }
}

export async function toggleUserActive(userId: string) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { success: false, error: 'User not found' };

        await prisma.user.update({
            where: { id: userId },
            data: { isActive: !user.isActive },
        });
        revalidatePath('/(dashboard)/admin/users', 'page');
        return { success: true };
    } catch (error) {
        console.error('Failed to toggle user:', error);
        return { success: false, error: 'Failed to toggle user status' };
    }
}
