import type { MenuItem, Promotion, PromotionRule, Category } from '@/generated/prisma/client';
import { calcEffectivePrice } from '@/lib/pricing';

export interface CartItemInput {
    menuItemId: string;
    quantity: number;
}

export interface CalculatedItem {
    menuItemId: string;
    quantity: number;
    basePrice: number;
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

type ExtendedMenuItem = MenuItem & {
    category: Category;
};

/**
 * Centralized cart calculation.
 * 1. Appies COMBO promotions first (greedy approach: highest value combos first).
 * 2. Applies SIMPLE promotions (Fixed/Percent) to remaining items.
 */
export function calculateCart(
    cartItems: CartItemInput[],
    menuItems: ExtendedMenuItem[],
    activePromotions: ExtendedPromotion[]
): CalculationResult {
    // 1. Expand cart into individual units for easier processing
    // e.g. { id: 'burger', qty: 2 } -> ['burger', 'burger']
    let remainingUnits: string[] = [];
    const itemMap = new Map<string, ExtendedMenuItem>();

    for (const item of cartItems) {
        const dbItem = menuItems.find((m) => m.id === item.menuItemId);
        if (!dbItem) continue;
        itemMap.set(dbItem.id, dbItem);
        for (let i = 0; i < item.quantity; i++) {
            remainingUnits.push(item.menuItemId);
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
    const matchesRule = (itemId: string, rule: PromotionRule) => {
        const item = itemMap.get(itemId);
        if (!item) return false;
        if (rule.menuItemId && rule.menuItemId === item.id) return true;
        if (rule.categoryId && rule.categoryId === item.categoryId) return true;
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
                    const foundIdx = tempRemaining.findIndex((uid) => matchesRule(uid, rule));
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

                const triggerItems: ExtendedMenuItem[] = [];
                const rewardItems: ExtendedMenuItem[] = [];

                // Extract valid items for this combo instance
                for (const rule of combo.rules) {
                    for (let i = 0; i < rule.requiredQuantity; i++) {
                        const idx = unitsToProcess.findIndex((uid) => matchesRule(uid, rule));
                        const itemId = unitsToProcess[idx];
                        const item = itemMap.get(itemId)!;

                        if (rule.isDiscounted) {
                            rewardItems.push(item);
                        } else {
                            triggerItems.push(item);
                        }

                        // Remove from availability
                        unitsToProcess.splice(idx, 1);
                        const globalIdx = remainingUnits.indexOf(itemId);
                        if (globalIdx !== -1) remainingUnits.splice(globalIdx, 1);
                    }
                }

                // Calculate Prices
                // Case A: Mixed (Trigger + Reward) -> "Buy X (full), Get Y for $Z"
                // Case B: All Discounted (or None) -> "Bundle is $Z"

                const hasTrigger = triggerItems.length > 0;
                const hasReward = rewardItems.length > 0;

                if (hasTrigger && hasReward) {
                    // Trigger items stay full price
                    for (const item of triggerItems) {
                        finalItems.push({
                            menuItemId: item.id,
                            quantity: 1,
                            basePrice: item.basePrice,
                            frozenPrice: item.basePrice,
                            discount: 0,
                            appliedPromoId: combo.id,
                        });
                    }

                    // Reward items share the combo.value
                    const rewardBaseTotal = rewardItems.reduce((sum, i) => sum + i.basePrice, 0);
                    const ratio = rewardBaseTotal > 0 ? combo.value / rewardBaseTotal : 0;

                    for (const item of rewardItems) {
                        const frozenPrice = item.basePrice * ratio;
                        finalItems.push({
                            menuItemId: item.id,
                            quantity: 1,
                            basePrice: item.basePrice,
                            frozenPrice,
                            discount: item.basePrice - frozenPrice,
                            appliedPromoId: combo.id,
                        });
                    }

                } else {
                    // Bundle Strategy (Distribute across all)
                    const allItems = [...triggerItems, ...rewardItems];
                    const baseTotal = allItems.reduce((sum, i) => sum + i.basePrice, 0);
                    const ratio = baseTotal > 0 ? combo.value / baseTotal : 0;

                    for (const item of allItems) {
                        const frozenPrice = item.basePrice * ratio;
                        finalItems.push({
                            menuItemId: item.id,
                            quantity: 1,
                            basePrice: item.basePrice,
                            frozenPrice,
                            discount: item.basePrice - frozenPrice,
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
    for (const itemId of remainingUnits) {
        const item = itemMap.get(itemId)!;
        const { effectivePrice, appliedPromo, discount } = calcEffectivePrice(
            { id: item.id, basePrice: item.basePrice, categoryId: item.categoryId },
            simplePromos
        );

        finalItems.push({
            menuItemId: item.id,
            quantity: 1,
            basePrice: item.basePrice,
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
    const subtotal = groupedItems.reduce((acc, i) => acc + i.frozenPrice * i.quantity, 0);
    const baseTotal = groupedItems.reduce((acc, i) => acc + i.basePrice * i.quantity, 0); // Original price

    const tax = subtotal * 0.07; // 7% Tax
    const total = subtotal + tax;

    return {
        items: groupedItems,
        subtotal: subtotal,
        discount: baseTotal - subtotal,
        tax: tax,
        total: total,
    };
}
