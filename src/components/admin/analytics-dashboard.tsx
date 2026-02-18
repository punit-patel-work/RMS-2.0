'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Tag,
  Banknote,
  CreditCard,
  Download,
  Trash2,
} from 'lucide-react';
import { getSalesAnalytics } from '@/server/queries/analytics.queries';
import { formatCurrency } from '@/lib/pricing';
import { RevenueChart } from './analytics/revenue-chart';
import { OrderTypeChart } from './analytics/order-type-chart';
import { CategorySalesChart } from './analytics/category-sales-chart';

type AnalyticsData = Awaited<ReturnType<typeof getSalesAnalytics>>;

const periods = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
] as const;

function getDateRange(period: string) {
  const end = new Date();
  const start = new Date();

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    start.setDate(start.getDate() - 7);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 30);
  }

  return { startDate: start, endDate: end };
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const loadData = () => {
    startTransition(async () => {
      const range = getDateRange(period);
      const result = await getSalesAnalytics(range);
      setData(result);
    });
  };

  const handleExportCsv = () => {
    if (!data) return;

    const rows = [
      ['Metric', 'Value'],
      ['Gross Sales', data.grossSales.toFixed(2)],
      ['Order Count', data.orderCount.toString()],
      ['Average Ticket', data.averageTicket.toFixed(2)],
      ['Total Discount', data.totalDiscount.toFixed(2)],
      ['Voided Items', data.voidedItemCount.toString()],
      ['Void Value', data.voidedItemValue.toFixed(2)],
      ['Cash Orders', data.paymentBreakdown.cash.count.toString()],
      ['Cash Total', data.paymentBreakdown.cash.total.toFixed(2)],
      ['Card Orders', data.paymentBreakdown.card.count.toString()],
      ['Card Total', data.paymentBreakdown.card.total.toFixed(2)],
      [],
      ['Top Items', 'Qty Sold', 'Revenue'],
      ...data.topItems.map((i) => [i.name, i.count.toString(), i.revenue.toFixed(2)]),
    ];

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rms-analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {periods.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={!data}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gross Sales</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(data.grossSales)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Orders</p>
                    <p className="text-xl font-bold">{data.orderCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Ticket</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(data.averageTicket)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Discounts Given</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(data.totalDiscount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tax Collected</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(data.totalTax)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Voided Items</p>
                    <p className="text-xl font-bold">
                      {data.voidedItemCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Void Value</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(data.voidedItemValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>          </div>

          {/* Charts Row 1: Revenue & Order Types */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RevenueChart data={data.salesTrend} />
            <OrderTypeChart data={data.orderTypeBreakdown} />
          </div>

          {/* Charts Row 2: Category Sales & Top Items */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CategorySalesChart data={data.categorySales} />
            
            {/* Top Items Table */}
            <Card className="col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Selling Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
                {data.topItems.map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center p-0 text-[10px]">
                        {i + 1}
                      </Badge>
                      <span className="text-sm font-medium truncate max-w-[120px]" title={item.name}>{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(item.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} sold
                      </p>
                    </div>
                  </div>
                ))}
                {data.topItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sales data
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-emerald-500" />
                    <span>Cash</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(data.paymentBreakdown.cash.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.paymentBreakdown.cash.count} orders
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                    <span>Card (External)</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(data.paymentBreakdown.card.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.paymentBreakdown.card.count} orders
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {isPending && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p>Loading analytics...</p>
        </div>
      )}
    </div>
  );
}
