/**
 * F-M20: server actions historically returned `{ success: false, error: 'Failed
 * to X' }` and tossed the real cause to console.error — making field-only
 * exception reproductions a guessing game and silently masking bugs in dev.
 *
 * `friendly()` keeps the human-readable label users see in production, but in
 * non-production environments appends the actual error message so the toast
 * the developer sees on screen tells them what really broke. Implementation
 * info is never leaked in prod (NODE_ENV === 'production').
 */
export function friendly(label: string, error: unknown): string {
    if (process.env.NODE_ENV === 'production') return label;
    const detail = error instanceof Error ? error.message : String(error);
    return detail ? `${label}: ${detail}` : label;
}
