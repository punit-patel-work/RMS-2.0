'use client';

/**
 * P-H2: extracted from order-builder.tsx (formerly 1000+ lines of mixed
 * concerns). This component owns the per-line cart row: name, modifiers,
 * promo signal, qty stepper, notes button, remove button. The parent now
 * just maps cart items to <CartLineItem /> and passes a small set of
 * callbacks — the parent gets ~80 fewer lines of nested JSX, and the line
 * row becomes independently testable.
 */

import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, MessageSquare } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing';
import type { CartItem } from '@/types';

interface CartLineItemProps {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onEditNotes: () => void;
}

export function CartLineItem({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onEditNotes,
}: CartLineItemProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm">{item.name}</p>
          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
            <p className="text-xs text-muted-foreground leading-tight mt-0.5 mb-0.5">
              {item.selectedModifiers.map((m) => m.name).join(', ')}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {item.discount > 0 ? (
              <>
                <span className="line-through">{formatCurrency(item.basePrice)}</span>
                <span className="text-emerald-500">{formatCurrency(item.effectivePrice)}</span>
                {/* F-M14: cashier-visible signal that a promo applied. */}
                <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                  PROMO
                </span>
              </>
            ) : (
              <span>{formatCurrency(item.basePrice)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onDecrement}>
            <Minus className="w-3 h-3" />
          </Button>
          <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onIncrement}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Notes / Allergy input */}
      <div className="flex items-center gap-1">
        {item.notes ? (
          <button
            className="text-xs text-amber-600 flex items-center gap-1 hover:underline"
            onClick={onEditNotes}
          >
            <MessageSquare className="w-3 h-3" />
            {item.notes}
          </button>
        ) : (
          <button
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
            onClick={onEditNotes}
          >
            <MessageSquare className="w-3 h-3" />
            Add note / allergy
          </button>
        )}
      </div>
    </div>
  );
}
