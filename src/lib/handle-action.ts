import { toast } from 'sonner';

/**
 * Wraps a server action call with consistent toast notifications.
 * Shows success/error toasts automatically.
 *
 * @example
 * const result = await handleAction(
 *   reserveTable({ tableId, guestName, ... }),
 *   'Table reserved'
 * );
 * if (result.success) router.refresh();
 */
export async function handleAction<T extends Record<string, unknown>>(
    action: Promise<{ success: boolean; error?: string } & T>,
    successMessage: string,
): Promise<{ success: boolean; error?: string } & T> {
    try {
        const result = await action;
        if (result.success) {
            toast.success(successMessage);
        } else {
            toast.error(result.error || 'Something went wrong');
        }
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        toast.error(message);
        return { success: false, error: message } as { success: boolean; error: string } & T;
    }
}
