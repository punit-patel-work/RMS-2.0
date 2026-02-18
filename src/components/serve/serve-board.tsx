'use client';

import { useState, useTransition } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ConciergeBell,
  Package,
  CheckCircle2,
  Banknote,
  CreditCard,
  Clock,
} from 'lucide-react';
import { serveItem, serveAllItems, collectLaterPayment } from '@/server/actions/order.actions';
import { formatCurrency } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export function ServeBoard() {
  const { data, mutate, isLoading } = useSWR('/api/serve/ready', fetcher, {
    refreshInterval: 5000,
  });
  const [isPending, startTransition] = useTransition();
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentCustomer, setPaymentCustomer] = useState('');

  const orders = data?.orders ?? [];

  const handleServeItem = (itemId: string) => {
    startTransition(async () => {
      const result = await serveItem(itemId);
      if (result.success) {
        toast.success('Item served ✓');
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleServeAll = (orderId: string) => {
    startTransition(async () => {
      const result = await serveAllItems(orderId);
      if (result.success) {
        toast.success('All items served ✓');
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleCollectPayment = (method: 'CASH' | 'CARD_EXTERNAL') => {
    if (!paymentOrderId) return;
    startTransition(async () => {
      const result = await collectLaterPayment(paymentOrderId, method);
      if (result.success) {
        toast.success('Payment collected ✓');
        setPaymentOrderId(null);
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading orders...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        <p className="text-lg font-medium">All caught up!</p>
        <p className="text-sm">No items waiting to be served</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map((order: any) => {
          const isTakeout = order.orderType === 'TAKEOUT';
          const isLaterPay = order.paymentMethod === 'LATER_PAY';
          const readyItems = order.items.filter((i: any) => i.status === 'READY');
          const totalItems = order.items.filter((i: any) => i.status !== 'VOIDED').length;
          const servedItems = order.items.filter((i: any) => i.status === 'SERVED').length;

          // Derive label
          const label = isTakeout
            ? `📦 ${order.customerName || 'Takeout'}`
            : order.table?.name ?? 'Unknown Table';

          return (
            <Card
              key={order.id}
              className={cn(
                'border-2 transition-all',
                isTakeout
                  ? 'border-purple-300 bg-purple-50/50'
                  : 'border-blue-300 bg-blue-50/50'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{label}</CardTitle>
                    {isTakeout && (
                      <Badge
                        variant="outline"
                        className="bg-purple-100 text-purple-700 border-purple-200"
                      >
                        <Package className="w-3 h-3 mr-1" />
                        Takeout
                      </Badge>
                    )}
                    {isLaterPay && (
                      <Badge
                        variant="outline"
                        className="bg-amber-100 text-amber-700 border-amber-200"
                      >
                        💳 Pay on pickup
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {readyItems.length} ready / {totalItems} total
                  </Badge>
                </div>
                {isTakeout && order.customerPhone && (
                  <p className="text-xs text-muted-foreground">
                    📱 {order.customerPhone}
                  </p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {timeAgo(order.createdAt)}
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                {order.items.map((item: any) => {
                  if (item.status === 'VOIDED') return null;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between py-1.5 px-2 rounded-md',
                        item.status === 'READY' && 'bg-emerald-100/60',
                        item.status === 'SERVED' && 'bg-gray-100 opacity-50',
                        item.status === 'PENDING' && 'bg-amber-50'
                      )}
                    >
                      <div className="flex-1">
                        <span className="font-medium text-sm">
                          {item.quantity}× {item.menuItem.name}
                        </span>
                        {item.notes && (
                          <p className="text-xs text-amber-600">⚠ {item.notes}</p>
                        )}
                      </div>

                      {item.status === 'READY' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-emerald-600 hover:bg-emerald-100 gap-1"
                          onClick={() => handleServeItem(item.id)}
                          disabled={isPending}
                        >
                          <ConciergeBell className="w-3.5 h-3.5" />
                          Serve
                        </Button>
                      )}
                      {item.status === 'SERVED' && (
                        <Badge variant="outline" className="text-xs bg-gray-100">
                          ✓ Served
                        </Badge>
                      )}
                      {item.status === 'PENDING' && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600">
                          Cooking
                        </Badge>
                      )}
                    </div>
                  );
                })}

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {formatCurrency(order.total)}
                  </span>

                  <div className="flex gap-2">
                    {/* Serve All button */}
                    {readyItems.length > 1 && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => handleServeAll(order.id)}
                        disabled={isPending}
                      >
                        <ConciergeBell className="w-3.5 h-3.5" />
                        Serve All ({readyItems.length})
                      </Button>
                    )}

                    {/* Collect Payment for LATER_PAY orders */}
                    {isLaterPay && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => {
                          setPaymentOrderId(order.id);
                          setPaymentTotal(order.total);
                          setPaymentCustomer(order.customerName || 'Customer');
                        }}
                        disabled={isPending}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        Collect Payment
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment Collection Dialog */}
      <Dialog
        open={paymentOrderId !== null}
        onOpenChange={(open) => { if (!open) setPaymentOrderId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Payment — {paymentCustomer}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-3xl font-bold">{formatCurrency(paymentTotal)}</p>
            <p className="text-sm text-red-500 mt-2 font-medium">
              ⚠️ Payment must be collected before handover
            </p>
          </div>
          <DialogFooter className="flex gap-3 sm:justify-center">
            <Button
              size="lg"
              className="flex-1 gap-2 h-16 text-lg"
              variant="outline"
              onClick={() => handleCollectPayment('CASH')}
              disabled={isPending}
            >
              <Banknote className="w-6 h-6" />
              Cash
            </Button>
            <Button
              size="lg"
              className="flex-1 gap-2 h-16 text-lg"
              variant="outline"
              onClick={() => handleCollectPayment('CARD_EXTERNAL')}
              disabled={isPending}
            >
              <CreditCard className="w-6 h-6" />
              Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
