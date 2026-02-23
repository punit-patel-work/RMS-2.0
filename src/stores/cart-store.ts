'use client';

import { create } from 'zustand';
import type { CartItem } from '@/types';
import { calculateCart } from '@/lib/cart-calculations';
import type { MenuItem, Promotion, Category, PromotionRule } from '@/generated/prisma/client';

// Extended type for promotions with rules (what we get from server)
type ExtendedPromotion = Promotion & {
    rules: (PromotionRule & {
        menuItem?: MenuItem | null;
        category?: Category | null;
    })[];
};

interface CartStore {
    tableId: string | null;
    tableName: string | null;
    promotions: ExtendedPromotion[]; // Store promotions for recalculation
    items: CartItem[];

    // Derived totals
    subtotal: number;
    discount: number;
    tax: number;
    total: number;

    // Actions
    setTable: (tableId: string, tableName: string) => void;
    setPromotions: (promotions: ExtendedPromotion[]) => void;
    addItem: (
        item: Pick<MenuItem, 'id' | 'name' | 'basePrice' | 'categoryId'>,
        selectedModifiers?: { modifierId: string; name: string; priceAdjustment: number }[]
    ) => void;
    removeItem: (cartItemId: string) => void;
    updateQuantity: (cartItemId: string, delta: number) => void;
    setNotes: (cartItemId: string, notes: string) => void;
    reset: () => void;
}

// Helper to fully recalculate totals using the centralized logic
function recalc(items: CartItem[], promotions: ExtendedPromotion[]) {
    // 1. Construct minimal "ExtendedMenuItem" objects for calculation
    // We only need what calculateCart/matchesRule uses: id, basePrice, category.id
    const menuItems = items.map(i => ({
        id: i.menuItemId,
        basePrice: i.basePrice,
        categoryId: i.categoryId, // Required for matchesRule
        category: { id: i.categoryId }
    })) as any; // Cast to ExtendedMenuItem (we cheat a bit on missing props)

    // 2. Run calculation
    const result = calculateCart(
        items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        menuItems,
        promotions
    );

    // 3. Update items' effective prices (frozenPrice) based on result?
    // calculateCart returns average frozen prices in groupedItems?
    // In `calculateCart.ts`, step 4 returns groupedItems with `frozenPrice`.
    // We should update our `items` with this new price info so UI shows correct per-item price.
    // However, our `items` might have notes. `result.items` are grouped by `appliedPromo`.
    // If I have 2 Burgers (1 Normal, 1 Cheese), and 1 is discounted... 
    // `result.items` might distinct them by Promo ID.
    // This is UI complexity. 
    // For now, let's just update the TOTALS.
    // And simplistic per-item effective price (avg)?

    // Let's iterate our `items` and try to attach average effective price from result.
    const updatedItems = items.map(i => {
        const matches = result.items.filter(r => r.menuItemId === i.menuItemId);
        if (matches.length > 0) {
            const totalVal = matches.reduce((acc, m) => acc + m.frozenPrice * m.quantity, 0);
            const totalQty = matches.reduce((acc, m) => acc + m.quantity, 0);
            const avg = totalVal / totalQty;
            return {
                ...i,
                effectivePrice: avg,
                discount: i.basePrice - avg // derived
            };
        }
        return { ...i, effectivePrice: i.basePrice, discount: 0 };
    });

    return {
        items: updatedItems,
        subtotal: result.subtotal,
        discount: result.discount,
        tax: result.tax,
        total: result.total
    };
}

export const useCartStore = create<CartStore>((set) => ({
    tableId: null,
    tableName: null,
    promotions: [],
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,

    setTable: (tableId, tableName) => set({ tableId, tableName }),

    setPromotions: (promotions) => set((state) => {
        // Recalc existing items with new promos
        const res = recalc(state.items, promotions);
        return { promotions, ...res };
    }),

    addItem: (item, selectedModifiers) =>
        set((state) => {
            const sortedMods = [...(selectedModifiers || [])].sort((a, b) => a.modifierId.localeCompare(b.modifierId));
            const signature = JSON.stringify({ id: item.id, mods: sortedMods.map(m => m.modifierId) });

            const existing = state.items.find((i) => i.id === signature);
            let updatedItems: CartItem[];

            if (existing) {
                updatedItems = state.items.map((i) =>
                    i.id === signature
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                );
            } else {
                const modifierTotal = sortedMods.reduce((sum, mod) => sum + mod.priceAdjustment, 0);
                const newItem: CartItem = {
                    id: signature,
                    menuItemId: item.id,
                    name: item.name,
                    quantity: 1,
                    basePrice: item.basePrice + modifierTotal,
                    categoryId: item.categoryId,
                    effectivePrice: item.basePrice + modifierTotal,
                    discount: 0,
                    selectedModifiers: sortedMods,
                };
                updatedItems = [...state.items, newItem];
            }

            return recalc(updatedItems, state.promotions);
        }),

    removeItem: (cartItemId) =>
        set((state) => {
            const updatedItems = state.items.filter((i) => i.id !== cartItemId);
            return recalc(updatedItems, state.promotions);
        }),

    updateQuantity: (cartItemId, delta) =>
        set((state) => {
            const updatedItems = state.items
                .map((i) =>
                    i.id === cartItemId
                        ? { ...i, quantity: Math.max(0, i.quantity + delta) }
                        : i
                )
                .filter((i) => i.quantity > 0);
            return recalc(updatedItems, state.promotions);
        }),

    setNotes: (cartItemId, notes) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.id === cartItemId ? { ...i, notes } : i
            ),
        })),

    reset: () =>
        set({
            tableId: null,
            tableName: null,
            items: [],
            subtotal: 0,
            discount: 0,
            tax: 0,
            total: 0,
        }),
}));
