'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame } from 'lucide-react';

interface HeatmapCell {
  day: number;   // 0 = Sun
  hour: number;  // 0..23
  revenue: number;
  count: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Hour × day-of-week revenue heatmap. Pure CSS grid — no chart library.
 * Useful for staffing decisions ("we're slammed Sat 7-9 PM but dead Mon noon").
 *
 * Visual encoding: cell intensity = revenue scaled to the period's max.
 * The current hour gets a thin ring outline so the operator sees "you are
 * here" at a glance.
 */
export function Heatmap({ data }: { data: HeatmapCell[] }) {
  const maxRevenue = Math.max(0, ...data.map((c) => c.revenue));

  // Truncate to operating hours window for legibility (8am-11pm). Most
  // restaurants don't trade overnight; showing the dead 0-7am hours just
  // wastes screen real estate.
  const startHour = 8;
  const endHour = 23;
  const visibleHours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          When are we busiest?
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
            hour × day · revenue
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour header */}
            <div className="flex items-center gap-0.5 pl-9 mb-1">
              {visibleHours.map((h) => (
                <div
                  key={h}
                  className="w-5 text-[9px] text-muted-foreground text-center"
                  title={`${h}:00`}
                >
                  {h % 3 === 0 ? (h % 12 === 0 ? 12 : h % 12) : ''}
                </div>
              ))}
            </div>
            {/* Rows */}
            {DAY_LABELS.map((dayLabel, day) => (
              <div key={day} className="flex items-center gap-0.5 mb-0.5">
                <div className="w-9 text-[10px] text-muted-foreground font-medium pr-1 text-right">
                  {dayLabel}
                </div>
                {visibleHours.map((hour) => {
                  const cell = data.find((c) => c.day === day && c.hour === hour);
                  const revenue = cell?.revenue ?? 0;
                  const count = cell?.count ?? 0;
                  const intensity = maxRevenue > 0 ? revenue / maxRevenue : 0;
                  const isCurrent = day === currentDay && hour === currentHour;

                  return (
                    <div
                      key={hour}
                      className="w-5 h-5 rounded-sm transition-transform hover:scale-150 hover:z-10 cursor-help"
                      style={{
                        backgroundColor:
                          intensity > 0
                            ? `oklch(0.65 ${0.05 + intensity * 0.2} 35 / ${0.15 + intensity * 0.85})`
                            : 'var(--muted)',
                        outline: isCurrent ? '2px solid var(--primary)' : undefined,
                        outlineOffset: isCurrent ? '1px' : undefined,
                      }}
                      title={
                        revenue > 0
                          ? `${dayLabel} ${hour}:00 — $${revenue.toFixed(2)} (${count} order${count > 1 ? 's' : ''})`
                          : `${dayLabel} ${hour}:00 — no sales`
                      }
                    />
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 pl-9 text-[10px] text-muted-foreground">
              <span>Quiet</span>
              <div className="flex gap-0.5">
                {[0.1, 0.3, 0.5, 0.7, 1].map((v) => (
                  <div
                    key={v}
                    className="w-3 h-3 rounded-sm"
                    style={{
                      backgroundColor: `oklch(0.65 ${0.05 + v * 0.2} 35 / ${0.15 + v * 0.85})`,
                    }}
                  />
                ))}
              </div>
              <span>Slammed</span>
              {currentHour >= startHour && currentHour <= endHour && (
                <span className="ml-3 inline-flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm border-2 border-primary" /> Now
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
