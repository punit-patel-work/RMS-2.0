'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Tag,
  Banknote,
  CreditCard,
  Download,
  Trash2,
  Receipt,
  Timer,
  RefreshCcw,
  Wallet,
  Package2,
  RotateCcw,
} from 'lucide-react';
import { getSalesAnalytics } from '@/server/queries/analytics.queries';
import { formatCurrency } from '@/lib/pricing';
import dynamic from 'next/dynamic';
import { KpiCard } from './analytics/kpi-card';
import { InsightsPanel } from './analytics/insights-panel';
import { Heatmap } from './analytics/heatmap';
import { StaffLeaderboard } from './analytics/staff-leaderboard';
import { InventoryAlerts } from './analytics/inventory-alerts';
import { CustomerInsights } from './analytics/customer-insights';
import { MenuPerformance } from './analytics/menu-performance';

// Defer heavy chart components.
const RevenueChart = dynamic(() => import('./analytics/revenue-chart').then(m => m.RevenueChart), {
  ssr: false,
  loading: () => <div className="h-72 rounded bg-muted/30 animate-pulse" />,
});
const OrderTypeChart = dynamic(() => import('./analytics/order-type-chart').then(m => m.OrderTypeChart), {
  ssr: false,
  loading: () => <div className="h-64 rounded bg-muted/30 animate-pulse" />,
});

type AnalyticsData = Awaited<ReturnType<typeof getSalesAnalytics>>;

const periods = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
] as const;

function getDateRange(period: string) {
  const end = new Date();
  const start = new Date();
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === '7d') start.setDate(start.getDate() - 7);
  else if (period === '30d') start.setDate(start.getDate() - 30);
  else if (period === '90d') start.setDate(start.getDate() - 90);
  return { startDate: start, endDate: end };
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const loadData = () => {
    startTransition(async () => {
      const range = getDateRange(period);
      const result = await getSalesAnalytics(range);
      setData(result);
      setLastRefreshed(new Date());
    });
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ['RMS Analytics', `period=${period}`, `exported=${new Date().toISOString()}`],
      [],
      ['== HEADLINE =='],
      ['Metric', 'Value', 'vs Previous %'],
      ['Net Revenue', data.netRevenue.toFixed(2), data.deltas.netRevenue?.toFixed(1) ?? 'n/a'],
      ['Gross Sales', data.grossSales.toFixed(2), data.deltas.grossSales?.toFixed(1) ?? 'n/a'],
      ['Orders', data.orderCount, data.deltas.orderCount?.toFixed(1) ?? 'n/a'],
      ['Average Ticket', data.averageTicket.toFixed(2), data.deltas.averageTicket?.toFixed(1) ?? 'n/a'],
      ['Items Per Order', data.itemsPerOrder.toFixed(2), ''],
      ['Total Discount', data.totalDiscount.toFixed(2), ''],
      ['Tax Collected', data.totalTax.toFixed(2), ''],
      ['Voided Items', data.voidedItemCount, ''],
      ['Refund Total', data.totalRefunds.toFixed(2), ''],
      [],
      ['== TOP ITEMS =='],
      ['Item', 'Qty', 'Revenue', 'Category'],
      ...data.topItems.map((i) => [i.name, i.count, i.revenue.toFixed(2), i.categoryName]),
      [],
      ['== STAFF =='],
      ['Name', 'Role', 'Orders', 'Revenue', 'Avg Ticket'],
      ...data.staffLeaderboard.map((s) => [s.name, s.role, s.orders, s.revenue.toFixed(2), s.avgTicket.toFixed(2)]),
      [],
      ['== TOP CUSTOMERS =='],
      ['Name', 'Phone', 'Orders', 'Total Spent'],
      ...data.customers.top.map((c) => [c.name ?? 'Anonymous', c.phone, c.orderCount, c.totalSpent.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rms-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. STICKY TOOLBAR ─────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-background/85 backdrop-blur-md border-b">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md bg-muted p-0.5">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                disabled={isPending}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {lastRefreshed && (
            <span className="text-[10px] text-muted-foreground hidden md:inline">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={isPending}
            className="gap-2"
            aria-label="Refresh analytics"
          >
            <RefreshCcw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!data}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Initial-load skeletons */}
      {!data && isPending && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-muted/30 animate-pulse" />
        </div>
      )}

      {data && (
        <>
          {/* ─── 2. HERO STRIP — 3 most important KPIs ─────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              hero
              label="Net Revenue"
              value={formatCurrency(data.netRevenue)}
              icon={Wallet}
              accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              delta={data.deltas.netRevenue}
              sublabel={`Gross ${formatCurrency(data.grossSales)} · after refunds & voids`}
              sparkline={data.sparklines.revenue}
            />
            <KpiCard
              hero
              label="Orders"
              value={data.orderCount.toString()}
              icon={ShoppingCart}
              accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
              delta={data.deltas.orderCount}
              sublabel={`${data.itemsPerOrder.toFixed(1)} items per order`}
              sparkline={data.sparklines.orders}
            />
            <KpiCard
              hero
              label="Average Ticket"
              value={formatCurrency(data.averageTicket)}
              icon={TrendingUp}
              accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              delta={data.deltas.averageTicket}
              sparkline={data.sparklines.avgTicket}
            />
          </div>

          {/* ─── 3. INSIGHTS GRID ──────────────────────────── */}
          <InsightsPanel insights={data.insights} />

          {/* ─── 4. REVENUE CHART (2/3) + INVENTORY (1/3) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RevenueChart data={data.salesTrend} />
            </div>
            <div className="lg:col-span-1">
              <InventoryAlerts items={data.lowStockItems} />
            </div>
          </div>

          {/* ─── 5. HEATMAP (full width — visual centerpiece) ─ */}
          <Heatmap data={data.heatmap} />

          {/* ─── 6. PEOPLE ROW (Staff + Customers, 2 cols) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StaffLeaderboard data={data.staffLeaderboard} />
            <CustomerInsights data={data.customers} />
          </div>

          {/* ─── 7. MENU PERFORMANCE (full width tabbed) ──── */}
          <MenuPerformance
            topItems={data.topItems}
            slowItems={data.slowItems}
            categories={data.categorySales}
          />

          {/* ─── 8. SECONDARY HEALTH STRIP (compact) ──────── */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Health & Operations
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Tax Collected"
                value={formatCurrency(data.totalTax)}
                icon={Receipt}
                accent="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              />
              <KpiCard
                label="Discounts"
                value={formatCurrency(data.totalDiscount)}
                icon={Tag}
                accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                sublabel={`${data.discountRate.toFixed(1)}% of base`}
              />
              <KpiCard
                label="Items / Order"
                value={data.itemsPerOrder.toFixed(1)}
                icon={Package2}
                accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
              />
              <KpiCard
                label="Avg Fulfillment"
                value={data.operations.avgFulfillmentMin !== null
                  ? `${data.operations.avgFulfillmentMin.toFixed(1)}m`
                  : '—'}
                icon={Timer}
                accent="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                sublabel="order → served"
              />
              <KpiCard
                label="Void Rate"
                value={`${data.voidRate.toFixed(1)}%`}
                icon={Trash2}
                accent="bg-red-500/10 text-red-600 dark:text-red-400"
                sublabel={`${data.voidedItemCount} items`}
                invertDelta
              />
              <KpiCard
                label="Refund Rate"
                value={`${data.refundRate.toFixed(1)}%`}
                icon={RotateCcw}
                accent="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                sublabel={formatCurrency(data.totalRefunds)}
                invertDelta
              />
            </div>
          </div>

          {/* ─── 9. BREAKDOWNS (Order Types + Payment Mix) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OrderTypeChart data={data.orderTypeBreakdown} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-violet-500" />
                  Payment Mix
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const total = data.paymentBreakdown.cash.total + data.paymentBreakdown.card.total;
                  const cashPct = total > 0 ? (data.paymentBreakdown.cash.total / total) * 100 : 0;
                  const cardPct = total > 0 ? (data.paymentBreakdown.card.total / total) * 100 : 0;
                  return (
                    <>
                      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{ width: `${cashPct}%` }}
                          title={`Cash: ${cashPct.toFixed(1)}%`}
                        />
                        <div
                          className="bg-blue-500 transition-all"
                          style={{ width: `${cardPct}%` }}
                          title={`Card: ${cardPct.toFixed(1)}%`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Banknote className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-medium">Cash</span>
                          </div>
                          <p className="text-lg font-bold tabular-nums">
                            {formatCurrency(data.paymentBreakdown.cash.total)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {data.paymentBreakdown.cash.count} orders · {cashPct.toFixed(0)}%
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-medium">Card</span>
                          </div>
                          <p className="text-lg font-bold tabular-nums">
                            {formatCurrency(data.paymentBreakdown.card.total)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {data.paymentBreakdown.card.count} orders · {cardPct.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
