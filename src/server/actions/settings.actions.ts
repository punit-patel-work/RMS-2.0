'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AuthError, requireOwner, requireSession } from '@/lib/auth-helpers';

// Keys that any authenticated user may read (e.g., tax rate for displaying totals).
// All other keys require a session; updates always require OWNER role.
export async function getSiteSettings() {
    try {
        await requireSession();
        const settings = await prisma.siteSettings.findMany();
        return settings.reduce((acc: Record<string, string>, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
    } catch (error) {
        if (error instanceof AuthError) return {};
        console.error('Failed to fetch site settings:', error);
        return {};
    }
}

export async function updateSiteSetting(key: string, value: string) {
    try {
        // Only OWNER can change tax rate, loyalty rate, etc. — direct revenue impact.
        await requireOwner();

        if (typeof key !== 'string' || key.length === 0 || key.length > 64) {
            return { success: false, error: 'Invalid setting key' };
        }
        if (typeof value !== 'string' || value.length > 1024) {
            return { success: false, error: 'Invalid setting value' };
        }

        await prisma.siteSettings.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) return { success: false, error: error.message };
        console.error(`Failed to update setting ${key}:`, error);
        return { success: false, error: 'Failed to update setting' };
    }
}

