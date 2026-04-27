'use client';

import useSWR from 'swr';
import { useEffect, useRef } from 'react';
import { jsonFetcher } from '@/lib/swr-fetcher';

// F-H8: use the shared hardened fetcher so non-2xx responses surface as
// SWR `error` instead of being silently swallowed as `data: undefined`.
const fetcher = jsonFetcher<{ orders: unknown[] }>;

/**
 * Plays a short beep using Web Audio API (no audio file needed).
 */
function playOrderBeep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880; // A5 note
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        // Play two quick beeps
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100; // C#6 note
        osc2.type = 'sine';
        gain2.gain.value = 0.3;
        osc2.start(ctx.currentTime + 0.2);
        osc2.stop(ctx.currentTime + 0.35);
    } catch {
        // AudioContext not available (server-side or unsupported)
    }
}

/**
 * Polls the KDS active orders endpoint every 5 seconds.
 * Returns orders with status OPEN that have PENDING items.
 * Plays a beep when new orders arrive.
 */
export function useKdsOrders() {
    const { data, error, isLoading, mutate } = useSWR(
        '/api/kds/active',
        fetcher,
        {
            refreshInterval: 5000,
            revalidateOnFocus: true,
            dedupingInterval: 2000,
        }
    );

    const prevCountRef = useRef<number | null>(null);
    const orders = data?.orders ?? [];

    useEffect(() => {
        if (prevCountRef.current !== null && orders.length > prevCountRef.current) {
            playOrderBeep();
        }
        prevCountRef.current = orders.length;
    }, [orders.length]);

    return {
        orders,
        isLoading,
        isError: !!error,
        refresh: mutate,
    };
}
