'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number | null;
  invertDelta?: boolean;
  accent?: string;
  sublabel?: string;
  /** Optional series of numbers to render as an inline sparkline. */
  sparkline?: number[];
  /** Make the tile larger / more prominent (HERO variant). */
  hero?: boolean;
}

/**
 * Reusable headline KPI tile. Two variants:
 *  - Compact (default): icon | label / value / delta in one row.
 *  - Hero: bigger value typography + inline sparkline ribbon at the bottom.
 *
 * The sparkline is a hand-rolled SVG (no chart-library dep) so it works
 * inside lazy-loaded admin code without re-pulling recharts.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  invertDelta = false,
  accent = 'bg-primary/10 text-primary',
  sublabel,
  sparkline,
  hero = false,
}: KpiCardProps) {
  const showDelta = delta !== undefined && delta !== null;
  const isPositive = (delta ?? 0) > 0;
  const isNegative = (delta ?? 0) < 0;
  const isFlat = delta === 0;
  const goodDirection = invertDelta ? isNegative : isPositive;
  const badDirection = invertDelta ? isPositive : isNegative;

  // Sparkline path
  const sparkPath = (() => {
    if (!sparkline || sparkline.length < 2) return null;
    const w = 100;
    const h = 28;
    const max = Math.max(...sparkline);
    const min = Math.min(...sparkline);
    const range = max - min || 1;
    const step = w / (sparkline.length - 1);
    const points = sparkline.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const linePath = `M ${points.join(' L ')}`;
    const fillPath = `${linePath} L ${w},${h} L 0,${h} Z`;
    return { linePath, fillPath };
  })();

  return (
    <Card className={cn('overflow-hidden relative', hero && 'lg:row-span-1')}>
      <CardContent className={cn(hero ? 'p-5' : 'p-4')}>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'rounded-lg flex items-center justify-center shrink-0',
              hero ? 'w-12 h-12' : 'w-10 h-10',
              accent
            )}
          >
            <Icon className={hero ? 'w-6 h-6' : 'w-5 h-5'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-muted-foreground truncate', hero ? 'text-sm' : 'text-xs')}>
              {label}
            </p>
            <p
              className={cn(
                'font-bold tracking-tight tabular-nums',
                hero ? 'text-3xl' : 'text-xl'
              )}
            >
              {value}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {showDelta && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-medium rounded-full px-1.5 py-0.5',
                    hero ? 'text-xs' : 'text-[11px]',
                    goodDirection && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    badDirection && 'bg-red-500/10 text-red-600 dark:text-red-400',
                    isFlat && 'bg-muted text-muted-foreground'
                  )}
                  title={`${delta!.toFixed(1)}% vs previous period`}
                >
                  {isPositive && <ArrowUp className="w-3 h-3" />}
                  {isNegative && <ArrowDown className="w-3 h-3" />}
                  {isFlat && <Minus className="w-3 h-3" />}
                  {Math.abs(delta!).toFixed(1)}%
                </span>
              )}
              {sublabel && (
                <span className={cn('text-muted-foreground truncate', hero ? 'text-xs' : 'text-[11px]')}>
                  {sublabel}
                </span>
              )}
            </div>
          </div>
        </div>
        {hero && sparkPath && (
          <svg
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            className="w-full h-7 mt-3"
            aria-hidden="true"
          >
            <path
              d={sparkPath.fillPath}
              className={cn(
                goodDirection && 'fill-emerald-500/15',
                badDirection && 'fill-red-500/15',
                !goodDirection && !badDirection && 'fill-primary/10'
              )}
            />
            <path
              d={sparkPath.linePath}
              fill="none"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              className={cn(
                goodDirection && 'stroke-emerald-500',
                badDirection && 'stroke-red-500',
                !goodDirection && !badDirection && 'stroke-primary'
              )}
            />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
