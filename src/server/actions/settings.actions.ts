'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getSiteSettings() {
    try {
        const settings = await prisma.siteSettings.findMany();
        // Convert array to object for easier consumption { key: value }
        return settings.reduce((acc: Record<string, string>, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
    } catch (error) {
        console.error('Failed to fetch site settings:', error);
        return {};
    }
}

export async function updateSiteSetting(key: string, value: string) {
    try {
        await prisma.siteSettings.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
        return { success: false, error: 'Failed to update setting' };
    }
}
