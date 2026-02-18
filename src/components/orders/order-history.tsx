'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Package,
  UtensilsCrossed,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  XCircle,
  Clock,
  Calendar,
  Zap,
} from 'lucide-react';
import { getOrders } from '@/server/queries/order.queries';
import { refundOrder, voidOrder } from '@/server/actions/order.actions';
import { formatCurrency } from '@/lib/pricing';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const REFUND_REASONS = [
  'Customer dissatisfaction',
  'Wrong order delivered',
  'Food quality issue',
  'Long wait time',
  'Customer changed mind',
  'Duplicate order',
  'Pricing error',
  'Other',
];

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  VOID: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-amber-100 text-amber-700',
};

type OrderData = Awaited<ReturnType<typeof getOrders>>[number];

export function OrderHistory() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;
  const canRefund = role === 'OWNER' || role === 'SUPERVISOR';
  const isFloorOnly = role === 'FLOOR_STAFF';

  const [isPending, startTransition] = useTransition();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Refund state
  const [refundOrder_, setRefundOrder] = useState<OrderData | null>(null);
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [refundReason, setRefundReason] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59.999`);

      const data = await getOrders({
        startDate: start,
        endDate: end,
        status: statusFilter,
        orderType: typeFilter,
        search: search.trim() || undefined,
      });
      setOrders(data);
    } catch {
      toast.error('Failed to load orders');
    }
    setLoading(false);
  }, [startDate, endDate, statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefund = () => {
    if (!refundOrder_ || !refundReason) {
      toast.error('Please select a reason');
      return;
    }
    if (refundType === 'PARTIAL' && selectedItemIds.length === 0) {
      toast.error('Select items to refund');
      return;
    }
    startTransition(async () => {
      const result = await refundOrder({
        orderId: refundOrder_.id,
        userId: userId ?? '',
        reason: refundReason,
        notes: refundReason === 'Other' ? refundNotes : undefined,
        type: refundType,
        itemIds: refundType === 'PARTIAL' ? selectedItemIds : undefined,
      });
      if (result.success) {
        toast.success(`Refunded ${formatCurrency(result.refundAmount ?? 0)}`);
        setRefundOrder(null);
        fetchOrders();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleVoid = (orderId: string) => {
    startTransition(async () => {
      const result = await voidOrder(orderId);
      if (result.success) {
        toast.success('Order voided');
        fetchOrders();
      } else {
        toast.error(result.error);
      }
    });
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Order #, table, customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Date Range — hidden for floor staff */}
            {!isFloorOnly && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-36"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-36"
                  />
                </div>
              </>
            )}

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="VOID">Void</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="DINE_IN">Dine-in</SelectItem>
                  <SelectItem value="TAKEOUT">Takeout</SelectItem>
                  <SelectItem value="QUICK_SALE">Quick Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No orders found</p>
        ) : (
          orders.map((order) => {
            const isExpanded = expandedId === order.id;
            const isTakeout = order.orderType === 'TAKEOUT';
            const isQuickSale = order.orderType === 'QUICK_SALE';

            return (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Summary Row */}
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}

                    <span className="font-bold w-16">#{order.orderNumber}</span>

                    {isQuickSale ? (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
                        <Zap className="w-3 h-3 fill-current" />
                        Quick Sale
                      </Badge>
                    ) : isTakeout ? (
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 gap-1">
                        <Package className="w-3 h-3" />
                        {order.customerName || 'Takeout'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <UtensilsCrossed className="w-3 h-3" />
                        {order.table?.name || 'N/A'}
                      </Badge>
                    )}

                    <Badge className={statusColors[order.status] || ''}>
                      {order.status}
                    </Badge>

                    {order.scheduledAt && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Calendar className="w-3 h-3" />
                        Scheduled
                      </Badge>
                    )}

                    <span className="ml-auto text-sm font-semibold">
                      {formatCurrency(order.total)}
                    </span>

                    <span className="text-xs text-muted-foreground w-32 text-right">
                      {formatDate(order.createdAt as unknown as string)}
                    </span>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-3 bg-muted/10">
                      {/* Items */}
                      <div className="space-y-1">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              'flex items-center justify-between py-1 px-2 rounded text-sm',
                              item.status === 'VOIDED' && 'line-through opacity-50',
                              item.refunded && 'bg-amber-50'
                            )}
                          >
                            <span>
                              {item.quantity}× {item.menuItem.name}
                              {item.notes && (
                                <span className="text-xs text-amber-500 ml-2">
                                  ({item.notes})
                                </span>
                              )}
                              {item.refunded && (
                                <Badge variant="outline" className="ml-2 text-xs text-amber-600">
                                  Refunded
                                </Badge>
                              )}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(item.frozenPrice * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      {/* Order Meta */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>By: {order.createdBy?.name}</span>
                        {order.paymentMethod && <span>Payment: {order.paymentMethod}</span>}
                        {order.discount > 0 && (
                          <span className="text-emerald-500">
                            Discount: -{formatCurrency(order.discount)}
                          </span>
                        )}
                        {order.refundAmount && (
                          <span className="text-amber-600">
                            Refunded: {formatCurrency(order.refundAmount)} ({order.refundReason})
                          </span>
                        )}
                        {order.scheduledAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pickup: {formatDate(order.scheduledAt as unknown as string)}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {order.status === 'OPEN' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-red-500 hover:text-red-600"
                            onClick={() => handleVoid(order.id)}
                            disabled={isPending}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Void Order
                          </Button>
                        )}
                        {order.status === 'PAID' && canRefund && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-amber-600 hover:text-amber-700"
                            onClick={() => {
                              setRefundOrder(order);
                              setRefundType('FULL');
                              setRefundReason('');
                              setRefundNotes('');
                              setSelectedItemIds([]);
                            }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Refund Dialog */}
      <Dialog
        open={refundOrder_ !== null}
        onOpenChange={(open) => { if (!open) setRefundOrder(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              Refund Order #{refundOrder_?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Refund Type */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Refund Type</Label>
              <Select
                value={refundType}
                onValueChange={(v) => setRefundType(v as 'FULL' | 'PARTIAL')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full Refund — {formatCurrency(refundOrder_?.total ?? 0)}</SelectItem>
                  <SelectItem value="PARTIAL">Partial Refund (select items)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Partial Item Selection */}
            {refundType === 'PARTIAL' && refundOrder_ && (
              <ScrollArea className="max-h-48 border rounded-lg p-2">
                <div className="space-y-2">
                  {refundOrder_.items
                    .filter((i) => i.status !== 'VOIDED' && !i.refunded)
                    .map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedItemIds.includes(item.id)}
                          onCheckedChange={(checked) => {
                            setSelectedItemIds((prev) =>
                              checked
                                ? [...prev, item.id]
                                : prev.filter((id) => id !== item.id)
                            );
                          }}
                        />
                        <span className="flex-1 text-sm">
                          {item.quantity}× {item.menuItem.name}
                        </span>
                        <span className="text-sm font-medium">
                          {formatCurrency(item.frozenPrice * item.quantity)}
                        </span>
                      </label>
                    ))}
                </div>
              </ScrollArea>
            )}

            {/* Reason */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Reason *</Label>
              <Select value={refundReason} onValueChange={setRefundReason}>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {REFUND_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes (shown for "Other") */}
            {refundReason === 'Other' && (
              <div className="space-y-1">
                <Label className="text-xs">Additional notes</Label>
                <Input
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Describe the reason..."
                />
              </div>
            )}

            {/* Refund Preview */}
            {refundType === 'PARTIAL' && selectedItemIds.length > 0 && refundOrder_ && (
              <div className="text-sm font-semibold text-right text-amber-600">
                Refund amount: {formatCurrency(
                  refundOrder_.items
                    .filter((i) => selectedItemIds.includes(i.id))
                    .reduce((s, i) => s + i.frozenPrice * i.quantity, 0)
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOrder(null)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleRefund}
              disabled={isPending || !refundReason}
            >
              {isPending ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
