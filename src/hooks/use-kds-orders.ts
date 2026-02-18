'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Polls the KDS active orders endpoint every 5 seconds.
 * Returns orders with status OPEN that have PENDING items.
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

    return {
        orders: data?.orders ?? [],
        isLoading,
        isError: !!error,
        refresh: mutate,
    };
}
