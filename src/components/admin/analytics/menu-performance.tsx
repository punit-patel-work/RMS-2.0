'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Snowflake, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/pricing';

interface MenuItem {
  name: string;
  count: number;
  revenue: number;
  categoryName: string;
}

interface CategoryRow {
  name: string;
  value: number;
  itemCount: number;
}

/**
 * Replaces the old separate "Top Sellers" + "Slow Movers" cards. One card
 * with three tabs: by revenue, by category, by what's not selling. Saves
 * a row in the layout and keeps the menu-engineering story in one place.
 */
export function MenuPerformance({
  topItems,
  slowItems,
  categories,
}: {
  topItems: MenuItem[];
  slowItems: MenuItem[];
  categories: CategoryRow[];
}) {
  const [tab, setTab] = useState<'top' | 'slow' | 'category'>('top');

  const tabs = [
    { id: 'top' as const, label: 'Top Sellers', icon: Flame, count: topItems.length },
    { id: 'slow' as const, label: 'Slow Movers', icon: Snowflake, count: slowItems.length },
    { id: 'category' as const, label: 'By Category', icon: Layers, count: categories.length },
  ];

  const maxCategoryValue = Math.max(0, ...categories.map((c) => c.value));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">Menu Performance</CardTitle>
        </div>
        <div className="flex gap-1 mt-1 -mb-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span
                  className={cn(
                    'tabular-nums text-[10px] px-1 rounded',
                    active ? 'bg-primary-foreground/20' : 'bg-muted-foreground/10'
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="max-h-[380px] overflow-y-auto">
        {tab === 'top' && (
          <div className="space-y-1.5">
            {topItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No sales yet.</p>
            )}
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'w-6 h-6 p-0 flex items-center justify-center text-[10px] shrink-0 font-bold',
                      i === 0 && 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {i + 1}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.categoryName}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.revenue)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{item.count} sold</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'slow' && (
          <div className="space-y-1.5">
            {slowItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Every item moved this period — healthy menu! ✓
              </p>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground mb-2 px-1">
                  Bottom sellers — candidates to 86, reprice, or feature in a promo.
                </p>
                {slowItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.categoryName}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {item.count} sold
                    </Badge>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'category' && (
          <div className="space-y-3">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No category data.</p>
            )}
            {categories.map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{cat.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {cat.itemCount} items
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(cat.value)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                    style={{ width: maxCategoryValue > 0 ? `${(cat.value / maxCategoryValue) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
