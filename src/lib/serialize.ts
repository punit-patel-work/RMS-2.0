/**
 * P-C5: replacement for `JSON.parse(JSON.stringify(x))` round-trips that pages
 * use to flatten Prisma data into Server-Component → Client-Component-safe
 * shapes. The only field type Prisma emits that isn't trivially serializable
 * is `Decimal` (modifier prices), so we walk the object once and coerce those
 * to plain numbers — everything else (Date, primitives, null, nested arrays)
 * passes through unchanged.
 *
 * Why not structuredClone: it preserves Decimal class instances, so the React
 * Server Components serializer downstream still rejects them.
 *
 * Why not JSON round-trip: O(n) string allocation + parse, and Date → string
 * loses type info that downstream code already handles correctly.
 */
type Plain = string | number | boolean | null | Date | Plain[] | { [k: string]: Plain };

function isDecimalLike(v: unknown): v is { toNumber: () => number } {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    // Decimal.js (which Prisma's Decimal extends) exposes both `toNumber()` AND
    // the internal `s` / `e` / `d` representation. The combined check avoids
    // false positives on random objects that happen to have a `toNumber` while
    // staying robust to bundler class-name mangling (`Decimal` → `Decimal2`)
    // that breaks a constructor.name check.
    return typeof o.toNumber === 'function'
        && typeof o.s === 'number'
        && typeof o.e === 'number'
        && Array.isArray(o.d);
}

export function toPlain<T>(value: T): T {
    return walk(value) as T;
}

function walk(v: unknown): Plain {
    if (v === null || v === undefined) return v as Plain;
    if (v instanceof Date) return v;
    if (isDecimalLike(v)) return v.toNumber();
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
        const out: Record<string, Plain> = {};
        for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
            out[k] = walk(child);
        }
        return out;
    }
    // string | number | boolean | bigint (bigint will throw at RSC boundary anyway)
    return v as Plain;
}
