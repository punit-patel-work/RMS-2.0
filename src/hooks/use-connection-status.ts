'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Monitors network connectivity and shows/dismisses a sticky toast
 * when the connection is lost or restored.
 */
export function useConnectionStatus() {
    const toastId = useRef<string | number | undefined>(undefined);

    useEffect(() => {
        const handleOffline = () => {
            toastId.current = toast.error('Connection lost — orders cannot be saved', {
                duration: Infinity,
                id: 'connection-lost',
            });
        };

        const handleOnline = () => {
            toast.dismiss('connection-lost');
            toast.success('Connection restored', { duration: 2000 });
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        // Check initial state
        if (!navigator.onLine) {
            handleOffline();
        }

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);
}
