/**
 * Shared SWR fetcher. The prior inline fetchers called `res.json()`
 * unconditionally, which silently returned `undefined` or a stringified HTML
 * error page on non-2xx responses — SWR would then treat the request as
 * "successful but empty," hiding auth failures, 500s, and network flaps from
 * the UI. This fetcher rejects on any !ok response so SWR surfaces `error`
 * and the caller can render a real error state (or trigger a retry).
 */
export class FetcherError extends Error {
    readonly status: number;
    readonly info: unknown;

    constructor(message: string, status: number, info: unknown) {
        super(message);
        this.name = 'FetcherError';
        this.status = status;
        this.info = info;
    }
}

export async function jsonFetcher<T = unknown>(url: string): Promise<T> {
    const res = await fetch(url);

    if (!res.ok) {
        // Try to surface the server's error body (JSON or text) without
        // letting a JSON parse throw on top of the original failure.
        let info: unknown = null;
        try {
            info = await res.clone().json();
        } catch {
            try {
                info = await res.text();
            } catch {
                info = null;
            }
        }
        throw new FetcherError(
            `Request to ${url} failed with status ${res.status}`,
            res.status,
            info
        );
    }

    try {
        return (await res.json()) as T;
    } catch (e) {
        throw new FetcherError(
            `Response from ${url} was not valid JSON`,
            res.status,
            e instanceof Error ? e.message : String(e)
        );
    }
}
