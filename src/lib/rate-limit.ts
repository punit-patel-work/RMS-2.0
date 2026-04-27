/**
 * In-memory sliding-window rate limiter.
 *
 * Why in-memory: this app runs as a single Node process; for the threat model
 * we care about (an attacker pounding bcrypt with PIN guesses against a known
 * employee ID) per-process counters are sufficient. If you horizontally scale,
 * swap the store for Redis — the public surface (`hit`, `reset`) stays the
 * same.
 *
 * Why sliding window: fixed-window counters let an attacker double their
 * effective rate by timing requests around the boundary. The sliding window
 * costs slightly more memory but accurately enforces N-per-T.
 *
 * Why we attach this to login + timeclock specifically:
 *   - S-H1: login is bcrypt-heavy and the only public-pre-auth attack surface.
 *   - S-H8: clockIn/clockOut/status all do bcrypt.compare against a 4-digit PIN.
 *     A few thousand guesses cracks the PIN space; rate limiting makes that
 *     take long enough that brute force becomes impractical and noisy.
 */

type Bucket = number[]; // unix-ms timestamps within the window

const store = new Map<string, Bucket>();

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    /** Seconds the caller should back off before trying again (0 if ok). */
    retryAfterSec: number;
}

/**
 * Record a hit and check if the caller is within the limit.
 *
 * @param key   Identifier — e.g. `login:ALICE` or `clock:ALICE`. Cardinality
 *              is controlled by you; don't shove free-form user input in here.
 * @param max   Max hits allowed within the window
 * @param windowMs  Sliding window length in milliseconds
 */
export function hit(key: string, max: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const cutoff = now - windowMs;

    let bucket = store.get(key);
    if (!bucket) {
        bucket = [];
        store.set(key, bucket);
    }

    // Drop expired timestamps in-place — keeps bucket bounded over long-running
    // process lifetime even for keys that get hit sporadically.
    while (bucket.length > 0 && bucket[0] < cutoff) {
        bucket.shift();
    }

    if (bucket.length >= max) {
        // Earliest timestamp + windowMs is when the next slot frees up.
        const earliest = bucket[0];
        const retryAfterMs = earliest + windowMs - now;
        return {
            ok: false,
            remaining: 0,
            retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
    }

    bucket.push(now);
    return {
        ok: true,
        remaining: Math.max(0, max - bucket.length),
        retryAfterSec: 0,
    };
}

/**
 * Clear the bucket for a key — call after a successful login so legitimate
 * users aren't penalized for prior fat-fingers.
 */
export function reset(key: string): void {
    store.delete(key);
}

/**
 * Periodic GC. Iterates all buckets and prunes empty / expired entries so
 * `store` doesn't accumulate forever for one-off keys. Call from a setInterval
 * if you care; otherwise the per-key cleanup in `hit()` keeps each individual
 * bucket bounded.
 */
export function gc(maxAgeMs = 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, bucket] of store.entries()) {
        if (bucket.length === 0 || bucket[bucket.length - 1] < cutoff) {
            store.delete(key);
        }
    }
}
