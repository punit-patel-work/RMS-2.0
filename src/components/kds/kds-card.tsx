'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { bumpItem, bumpOrder } from '@/server/actions/order.actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useKdsOrders } from '@/hooks/use-kds-orders';

interface OrderItem {
  id: string;
  quantity: number;
  frozenPrice: number;
  notes?: string | null;
  status: string;
  menuItem: { name: string };
}

interface KdsOrder {
  id: string;
  orderNumber: number;
  createdAt: string;
  orderType?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  table?: { name: string } | null;
  createdBy?: { name: string } | null;
  items: OrderItem[];
}

function getAgingInfo(createdAt: string) {
  const minutes = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 60000
  );

  if (minutes < 10) {
    return {
      minutes,
      borderClass: 'border-emerald-500/60',
      bgClass: 'bg-emerald-500/5',
      label: 'Fresh',
      pulse: false,
    };
  }

  if (minutes < 20) {
    return {
      minutes,
      borderClass: 'border-amber-500/60',
      bgClass: 'bg-amber-500/5',
      label: 'Warning',
      pulse: false,
    };
  }

  return {
    minutes,
    borderClass: 'border-red-500/80',
    bgClass: 'bg-red-500/5',
    label: 'Late',
    pulse: true,
  };
}

export function KdsCard({ order }: { order: KdsOrder }) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useKdsOrders();

  const aging = useMemo(() => getAgingInfo(order.createdAt), [order.createdAt]);
  const isTakeout = order.orderType === 'TAKEOUT';
  const pendingItems = order.items.filter((i) => i.status === 'PENDING');

  const handleBumpItem = (itemId: string) => {
    startTransition(async () => {
      const result = await bumpItem(itemId);
      if (result.success) {
        refresh();
      } else {
        toast.error('Failed to bump item');
      }
    });
  };

  const handleBumpAll = () => {
    startTransition(async () => {
      const result = await bumpOrder(order.id);
      if (result.success) {
        toast.success('All items marked ready');
        refresh();
      } else {
        toast.error('Failed to bump order');
      }
    });
  };

  return (
    <Card
      className={cn(
        'border-2 transition-all duration-300',
        aging.borderClass,
        aging.bgClass,
        aging.pulse && 'animate-pulse',
        isTakeout && 'ring-2 ring-purple-300'
      )}
    >
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              #{order.orderNumber}
            </span>
            {isTakeout ? (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                📦 {order.customerName || 'Takeout'}
              </Badge>
            ) : (
              order.table && (
                <Badge variant="secondary">{order.table.name}</Badge>
              )
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{aging.minutes}m</span>
          </div>
        </div>
        {isTakeout && order.customerPhone && (
          <p className="text-xs text-muted-foreground">📱 {order.customerPhone}</p>
        )}
        {order.createdBy && (
          <p className="text-xs text-muted-foreground">
            by {order.createdBy.name}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-2">
        {order.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center justify-between py-2 px-3 rounded-lg',
              item.status === 'READY' && 'bg-muted/50 opacity-50 line-through',
              item.status === 'PENDING' && 'bg-background'
            )}
          >
            <div className="flex-1">
              <span className="font-medium text-sm">
                {item.quantity}× {item.menuItem.name}
              </span>
              {item.notes && (
                <p className="text-xs text-amber-500">⚠ {item.notes}</p>
              )}
            </div>
            {item.status === 'PENDING' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10"
                onClick={() => handleBumpItem(item.id)}
                disabled={isPending}
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
            {item.status === 'READY' && (
              <Check className="w-4 h-4 text-emerald-500" />
            )}
          </div>
        ))}

        {pendingItems.length > 1 && (
          <Button
            variant="outline"
            className="w-full gap-2 mt-2"
            onClick={handleBumpAll}
            disabled={isPending}
          >
            <CheckCheck className="w-4 h-4" />
            Bump All
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
