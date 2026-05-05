import type { MenuItem, Promotion, PromotionRule, Category } from '@/generated/prisma/client';
import { calcEffectivePrice } from '@/lib/pricing';

export interface CartItemInput {
    menuItemId: string;
    quantity: number;
    modifiersPrice?: number;
}

export interface CalculatedItem {
    menuItemId: string;
    quantity: number;
    basePrice: number; // Includes modifiers
    frozenPrice: number; // Final price after all discounts (single or combo)
    discount: number;    // basePrice - frozenPrice
    appliedPromoId?: string;
}

export interface CalculationResult {
    items: CalculatedItem[];
    subtotal: number; // Sum of frozenPrice * quantity
    discount: number; // Sum of discount * quantity
    tax: number;      // 7% tax
    total: number;    // subtotal + tax
}

type ExtendedPromotion = Promotion & {
    rules: (PromotionRule & {
        menuItem?: MenuItem | null;
        category?: Category | null;
        isDiscounted: boolean;
    })[];
};

// Narrow structural type: calculateCart only actually reads id / basePrice /
// categoryId. The server passes the full MenuItem + category relation; the
// client store builds objects from React state. Using a narrow type here means
// neither caller needs to fabricate a MenuItem shape with `as any`.
export interface CartMenuItem {
    id: string;
    basePrice: number;
    categoryId: string;
}

/**
 * Centralized cart calculation.
 * 1. Appies COMBO promotions first (greedy approach: highest value combos first).
 * 2. Applies SIMPLE promotions (Fixed/Percent) to remaining items.
 */
// P-M4: tax rate is now a parameter rather than a hard-coded 0.07. Callers
// that have access to SiteSettings should pass the configured rate; the
// default keeps existing call sites working unchanged.
export const DEFAULT_TAX_RATE = 0.07;

export function calculateCart(
    cartItems: CartItemInput[],
    menuItems: CartMenuItem[],
    activePromotions: ExtendedPromotion[],
    taxRate: number = DEFAULT_TAX_RATE
): CalculationResult {
    // 1. Expand cart into individual units for easier processing
    // e.g. { id: 'burger', qty: 2 } -> [unit1, unit2]
    let remainingUnits: { uid: string; itemId: string; basePrice: number; categoryId: string }[] = [];
    const itemMap = new Map<string, CartMenuItem>();
    let uidCounter = 0;

    for (const item of cartItems) {
        const dbItem = menuItems.find((m) => m.id === item.menuItemId);
        if (!dbItem) continue;
        itemMap.set(dbItem.id, dbItem);

        const effectiveBasePrice = Number(dbItem.basePrice) + (item.modifiersPrice || 0);

        for (let i = 0; i < item.quantity; i++) {
            remainingUnits.push({
                uid: `unit_${uidCounter++}`,
                itemId: item.menuItemId,
                basePrice: effectiveBasePrice,
                categoryId: dbItem.categoryId
            });
        }
    }

    // Filter Combos vs Simple Promos
    const combos = activePromotions.filter((p) => p.type === 'COMBO');
    // Sort combos by value (highest price first? or heuristic).
    // For now, let's sort by raw value descending to favor big ticket combos.
    combos.sort((a, b) => b.value - a.value);

    const simplePromos = activePromotions.filter((p) => p.type !== 'COMBO');

    const finalItems: CalculatedItem[] = [];

    // Helper to find if a unit matches a rule
    const matchesRule = (unit: { itemId: string; categoryId: string }, rule: PromotionRule) => {
        if (rule.menuItemId && rule.menuItemId === unit.itemId) return true;
        if (rule.categoryId && rule.categoryId === unit.categoryId) return true;
        return false;
    };

    // 2. Apply Combos
    for (const combo of combos) {
        while (true) {
            // Check availability
            const usedIndices: number[] = [];
            let possible = true;
            const tempRemaining = [...remainingUnits];

            for (const rule of combo.rules) {
                let needed = rule.requiredQuantity;
                for (let i = 0; i < needed; i++) {
                    const foundIdx = tempRemaining.findIndex((unit) => matchesRule(unit, rule));
                    if (foundIdx === -1) {
                        possible = false;
                        break;
                    }
                    tempRemaining.splice(foundIdx, 1);
                }
                if (!possible) break;
            }

            if (possible) {
                // Combo matched!
                const unitsToProcess = [...remainingUnits];

                const triggerUnits: typeof remainingUnits = [];
                const rewardUnits: typeof remainingUnits = [];

                // Extract valid items for this combo instance
                for (const rule of combo.rules) {
                    for (let i = 0; i < rule.requiredQuantity; i++) {
                        const idx = unitsToProcess.findIndex((unit) => matchesRule(unit, rule));
                        const unit = unitsToProcess[idx];

                        if (rule.isDiscounted) {
                            rewardUnits.push(unit);
                        } else {
                            triggerUnits.push(unit);
                        }

                        // Remove from availability
                        unitsToProcess.splice(idx, 1);
                        const globalIdx = remainingUnits.findIndex(u => u.uid === unit.uid);
                        if (globalIdx !== -1) remainingUnits.splice(globalIdx, 1);
                    }
                }

                // Calculate Prices
                const hasTrigger = triggerUnits.length > 0;
                const hasReward = rewardUnits.length > 0;

                if (hasTrigger && hasReward) {
                    // Trigger items stay full price
                    for (const unit of triggerUnits) {
                        finalItems.push({
                            menuItemId: unit.itemId,
                            quantity: 1,
                            basePrice: unit.basePrice,
                            frozenPrice: unit.basePrice,
                            discount: 0,
                            appliedPromoId: combo.id,
                        });
                    }

                    // Reward items share the combo.value.
                    // F-M4: clamp combo.value to the reward subtotal so a misconfigured
                    // promo (e.g. value $20 on $5 of reward items) can't produce a
                    // ratio > 1 and inflate per-item prices above base.
                    const rewardBaseTotal = rewardUnits.reduce((sum, u) => sum + u.basePrice, 0);
                    const effectiveValue = Math.min(combo.value, rewardBaseTotal);
                    const ratio = rewardBaseTotal > 0 ? effectiveValue / rewardBaseTotal : 0;

                    for (const unit of rewardUnits) {
                        const frozenPrice = unit.basePrice * ratio;
                        finalItems.push({
                            menuItemId: unit.itemId,
                            quantity: 1,
                            basePrice: unit.basePrice,
                            frozenPrice,
                            discount: unit.basePrice - frozenPrice,
                            appliedPromoId: combo.id,
                        });
                    }

                } else {
                    // Bundle Strategy
                    const allUnits = [...triggerUnits, ...rewardUnits];
                    const baseTotal = allUnits.reduce((sum, u) => sum + u.basePrice, 0);
                    // F-M4 clamp: combo.value can never exceed the bundle's base total.
                    const effectiveValue = Math.min(combo.value, baseTotal);
                    const ratio = baseTotal > 0 ? effectiveValue / baseTotal : 0;

                    for (const unit of allUnits) {
                        const frozenPrice = unit.basePrice * ratio;
                        finalItems.push({
                            menuItemId: unit.itemId,
                            quantity: 1,
                            basePrice: unit.basePrice,
                            frozenPrice,
                            discount: unit.basePrice - frozenPrice,
                            appliedPromoId: combo.id,
                        });
                    }
                }

            } else {
                break;
            }
        }
    }

    // 3. Apply Simple Promos to remaining items
    for (const unit of remainingUnits) {
        const { effectivePrice, appliedPromo, discount } = calcEffectivePrice(
            { id: unit.itemId, basePrice: unit.basePrice, categoryId: unit.categoryId },
            simplePromos
        );

        finalItems.push({
            menuItemId: unit.itemId,
            quantity: 1,
            basePrice: unit.basePrice,
            frozenPrice: effectivePrice,
            discount,
            appliedPromoId: appliedPromo?.id,
        });
    }

    // 4. Group identical items back together (optional, but cleaner output)
    const groupedItems: CalculatedItem[] = [];
    for (const item of finalItems) {
        const existing = groupedItems.find(
            (g) => g.menuItemId === item.menuItemId && g.appliedPromoId === item.appliedPromoId
        );
        if (existing) {
            existing.quantity += 1;
            // Prices are per-unit, so they don't change
        } else {
            groupedItems.push({ ...item });
        }
    }

    // 5. Calculate final totals
    //
    // Tax policy: in most US jurisdictions (and for restaurant point-of-sale
    // compliance in general), sales tax is assessed on the PRE-DISCOUNT subtotal
    // for merchant-funded promotions — the state doesn't care that you gave the
    // customer a loyalty discount, it wants tax on what the meal costs.
    // Previously this file taxed the POST-discount subtotal, which systematically
    // under-reported tax and exposed the business to back-tax liability.
    //
    // Rounding: all money figures are rounded to the cent at the final step to
    // prevent float drift that would otherwise accumulate across dozens of line
    // items. Do NOT round intermediate per-item prices — the aggregate rounds
    // once at the end, which matches every major POS.
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const subtotal = groupedItems.reduce((acc, i) => acc + i.frozenPrice * i.quantity, 0);
    const baseTotal = groupedItems.reduce((acc, i) => acc + i.basePrice * i.quantity, 0); // Pre-discount

    const tax = baseTotal * taxRate; // configurable rate, default 7%
    const total = subtotal + tax;

    return {
        items: groupedItems,
        subtotal: round2(subtotal),
        discount: round2(baseTotal - subtotal),
        tax: round2(tax),
        total: round2(total),
    };
}
