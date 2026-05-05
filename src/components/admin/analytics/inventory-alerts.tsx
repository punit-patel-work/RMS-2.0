'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LowStockItem {
  id: string;
  name: string;
  stockQuantity: number;
  isAvailable: boolean;
  category: { name: string } | null;
}

/**
 * Stock-watch panel. Renders both states (healthy + alert) so the dashboard
 * has a stable shape regardless of inventory pressure — the right rail
 * doesn't pop in and out as items run low.
 */
export function InventoryAlerts({ items }: { items: LowStockItem[] }) {
  const empty = items.length === 0;

  return (
    <Card className={cn('flex flex-col', !empty && 'border-amber-500/30')}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {empty ? (
            <>
              <Package className="w-4 h-4 text-emerald-500" />
              Inventory
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Stock Alerts
              <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                {items.length}
              </Badge>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 max-h-[400px] overflow-y-auto">
        {empty ? (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium">All stock levels healthy</p>
            <p className="text-[11px] text-muted-foreground">
              Nothing tracked is below the warning threshold.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isCritical = item.stockQuantity === 0;
            const isLow = item.stockQuantity > 0 && item.stockQuantity <= 5;
            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between gap-2 p-2 rounded-md border',
                  isCritical && 'border-red-500/40 bg-red-500/5',
                  isLow && 'border-amber-500/40 bg-amber-500/5',
                  !isCritical && !isLow && 'border-border'
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.category?.name ?? 'Uncategorized'}
                    {!item.isAvailable && ' · 86\'d'}
                  </p>
                </div>
                <Badge
                  variant={isCritical ? 'destructive' : 'outline'}
                  className={cn(
                    'shrink-0 tabular-nums',
                    isLow && 'border-amber-500 text-amber-600 dark:text-amber-400'
                  )}
                >
                  {item.stockQuantity} left
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
