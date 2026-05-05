'use client';

import { TrendingUp, TrendingDown, Lightbulb, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  kind: 'positive' | 'negative' | 'neutral';
  title: string;
  detail: string;
}

/**
 * Auto-generated insight tiles. On wide screens this is a clean 3-column
 * grid (no overflow scroll); on narrow screens it falls back to a single
 * column. The first negative insight is promoted to the front of the list
 * client-side so urgent issues lead.
 */
export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4" />
        Not enough data this period to generate insights yet.
      </div>
    );
  }

  // Promote negative (action-required) insights to the front so the user
  // sees problems before pats-on-the-back.
  const sorted = [...insights].sort((a, b) => {
    const order = { negative: 0, neutral: 1, positive: 2 };
    return order[a.kind] - order[b.kind];
  });

  const iconFor = (kind: Insight['kind']) => {
    if (kind === 'positive') return <TrendingUp className="w-3.5 h-3.5" />;
    if (kind === 'negative') return <TrendingDown className="w-3.5 h-3.5" />;
    return <Lightbulb className="w-3.5 h-3.5" />;
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Insights</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          auto-generated · {insights.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((insight, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2.5 p-3 rounded-lg border-l-4 bg-card border-y border-r transition-shadow hover:shadow-sm',
              insight.kind === 'positive' && 'border-l-emerald-500',
              insight.kind === 'negative' && 'border-l-red-500',
              insight.kind === 'neutral' && 'border-l-blue-500'
            )}
          >
            <div
              className={cn(
                'mt-0.5 shrink-0 rounded-full p-1.5',
                insight.kind === 'positive' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                insight.kind === 'negative' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                insight.kind === 'neutral' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              )}
            >
              {iconFor(insight.kind)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{insight.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{insight.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
