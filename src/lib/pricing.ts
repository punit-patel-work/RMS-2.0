import type { MenuItem, Promotion } from '@/generated/prisma/client';

/**
 * Calculate the effective price of a menu item after applying the best
 * applicable promotion. This is a pure function — no side effects.
 *
 * Rules:
 * 1. Only active promotions are considered.
 * 2. ITEM-scoped promos match on menuItemId.
 * 3. CATEGORY-scoped promos match on categoryId.
 * 4. If multiple promos apply, the one giving the BIGGEST discount wins.
 * 5. Price can never go below 0.
 */
export function calcEffectivePrice(
    item: Pick<MenuItem, 'id' | 'basePrice' | 'categoryId'>,
    promotions: Promotion[]
): { effectivePrice: number; appliedPromo: Promotion | null; discount: number } {
    const applicablePromos = promotions.filter(
        (p) =>
            p.active &&
            ((p.scope === 'ITEM' && p.menuItemId === item.id) ||
                (p.scope === 'CATEGORY' && p.categoryId === item.categoryId))
    );

    if (applicablePromos.length === 0) {
        return { effectivePrice: item.basePrice, appliedPromo: null, discount: 0 };
    }

    let bestPromo: Promotion | null = null;
    let bestDiscount = 0;

    for (const promo of applicablePromos) {
        let discount = 0;

        if (promo.type === 'FIXED') {
            discount = promo.value;
        } else if (promo.type === 'PERCENT') {
            discount = item.basePrice * (promo.value / 100);
        }

        if (discount > bestDiscount) {
            bestDiscount = discount;
            bestPromo = promo;
        }
    }

    const effectivePrice = Math.max(0, item.basePrice - bestDiscount);

    return { effectivePrice, appliedPromo: bestPromo, discount: bestDiscount };
}

/**
 * Format a number as currency (USD).
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}
