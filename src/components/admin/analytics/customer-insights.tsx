'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Star, Phone } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing';

interface TopCustomer {
  id: string;
  name: string | null;
  phone: string;
  orderCount: number;
  totalSpent: number;
}

interface CustomerData {
  total: number;          // total customers in DB
  attachedOrders: number; // orders this period that had a customer attached
  attachRate: number;     // % of orders with customer attached
  repeatCount: number;    // customers with >1 order this period
  top: TopCustomer[];
  pointsRedeemed: number;
}

/**
 * Customer panel — covers loyalty health (attach rate, repeat rate) and
 * surfaces high-value regulars so staff can recognize them. The attach-rate
 * metric is a leading indicator: if it falls, the team is forgetting to
 * scan customer phones, which kills loyalty signups long-term.
 */
export function CustomerInsights({ data }: { data: CustomerData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-pink-500" />
          Customers & Loyalty
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top-line stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-lg font-bold tabular-nums">{data.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Total
            </p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-lg font-bold tabular-nums">{data.attachRate.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Attach Rate
            </p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-lg font-bold tabular-nums">{data.repeatCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Repeats
            </p>
          </div>
        </div>

        {data.pointsRedeemed > 0 && (
          <div className="flex items-center justify-between p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <span className="text-xs flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500" />
              Loyalty points redeemed
            </span>
            <span className="text-sm font-semibold tabular-nums">{data.pointsRedeemed}</span>
          </div>
        )}

        {/* Top customers */}
        {data.top.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              Top Spenders This Period
            </p>
            <div className="space-y-1.5">
              {data.top.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="w-5 h-5 p-0 flex items-center justify-center text-[9px] shrink-0">
                      {i + 1}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.name || 'Anonymous'}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {c.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(c.totalSpent)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.orderCount} order{c.orderCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
