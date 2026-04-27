'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import type { Role } from '@/generated/prisma/client';
import { AuthError, requireOwner } from '@/lib/auth-helpers';
import { z } from 'zod';

const VALID_ROLES: readonly Role[] = [
    'OWNER',
    'SUPERVISOR',
    'FLOOR_STAFF',
    'KITCHEN_STAFF',
] as const;

const roleSchema = z.enum(VALID_ROLES as [Role, ...Role[]]);
const pinSchema = z
    .string()
    .regex(/^\d{4,8}$/, 'PIN must be 4–8 digits');
const employeeIdSchema = z.string().trim().min(1).max(32);
const nameSchema = z.string().trim().min(1).max(100);

export async function createUser(
    employeeId: string,
    name: string,
    role: Role,
    pin: string
) {
    try {
        await requireOwner();

        const validatedEmployeeId = employeeIdSchema.parse(employeeId);
        const validatedName = nameSchema.parse(name);
        const validatedRole = roleSchema.parse(role);
        const validatedPin = pinSchema.parse(pin);

        const hashedPin = await hash(validatedPin, 10);
        await prisma.user.create({
            data: {
                employeeId: validatedEmployeeId,
                name: validatedName,
                role: validatedRole,
                pinCode: hashedPin,
            },
        });
        revalidatePath('/(dashboard)/admin/users', 'page');
        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message };
        }
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0]?.message ?? 'Invalid input' };
        }
        if (error?.code === 'P2002') {
            return { success: false, error: 'Employee ID already in use' };
        }
        console.error('Failed to create user:', error);
        return { success: false, error: 'Failed to create user' };
    }
}

export async function updateUser(
    userId: string,
    data: { employeeId?: string; name?: string; role?: Role; pin?: string }
) {
    try {
        const session = await requireOwner();

        // Self-role-change guard: prevent the sole active OWNER from demoting themselves
        if (data.role && data.role !== 'OWNER' && userId === session.user.id) {
            const otherOwners = await prisma.user.count({
                where: { role: 'OWNER', isActive: true, id: { not: userId } },
            });
            if (otherOwners === 0) {
                return {
                    success: false,
                    error: 'Cannot change role — at least one active OWNER must remain',
                };
            }
        }

        const updateData: Record<string, unknown> = {};
        if (data.employeeId) updateData.employeeId = employeeIdSchema.parse(data.employeeId);
        if (data.name) updateData.name = nameSchema.parse(data.name);
        if (data.role) updateData.role = roleSchema.parse(data.role);
        if (data.pin) updateData.pinCode = await hash(pinSchema.parse(data.pin), 10);

        await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
        revalidatePath('/(dashboard)/admin/users', 'page');
        return { success: true };
    } catch (error: any) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message };
        }
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0]?.message ?? 'Invalid input' };
        }
        if (error?.code === 'P2002') {
            return { success: false, error: 'Employee ID already in use' };
        }
        console.error('Failed to update user:', error);
        return { success: false, error: 'Failed to update user' };
    }
}

export async function toggleUserActive(userId: string) {
    try {
        const session = await requireOwner();

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { success: false, error: 'User not found' };

        // Prevent disabling yourself or the last active OWNER
        if (user.isActive && userId === session.user.id) {
            return { success: false, error: 'You cannot deactivate yourself' };
        }
        if (user.isActive && user.role === 'OWNER') {
            const otherActiveOwners = await prisma.user.count({
                where: { role: 'OWNER', isActive: true, id: { not: userId } },
            });
            if (otherActiveOwners === 0) {
                return {
                    success: false,
                    error: 'Cannot deactivate last remaining OWNER',
                };
            }
        }

        await prisma.user.update({
            where: { id: userId },
            data: { isActive: !user.isActive },
        });
        revalidatePath('/(dashboard)/admin/users', 'page');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message };
        }
        console.error('Failed to toggle user:', error);
        return { success: false, error: 'Failed to toggle user status' };
    }
}
