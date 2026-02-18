'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Flame,
  CreditCard,
  Banknote,
  FileText,
  XCircle,
  Check,
  ConciergeBell,
  MessageSquare,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { useCartStore } from '@/stores/cart-store';
import {
  fireOrder,
  addItemsToOrder,
  removeOrderItem,
  serveItem,
  recordPayment,
  printBill,
  voidOrder,
} from '@/server/actions/order.actions';
import { formatCurrency } from '@/lib/pricing';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Promotion, MenuItem, Category } from '@/generated/prisma/client';

interface OrderItemData {
  id: string;
  quantity: number;
  frozenPrice: number;
  notes?: string | null;
  status: string;
  menuItem: { name: string };
}

interface TableData {
  id: string;
  name: string;
  status: string;
  currentOrder?: {
    id: string;
    total: number;
    subtotal: number;
    discount: number;
    items: OrderItemData[];
  } | null;
}

type CategoryWithItems = Category & {
  items: MenuItem[];
};

interface Props {
  table: TableData;
  categories: CategoryWithItems[];
  promotions: Promotion[];
}

// Status badge styles
function statusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' };
    case 'READY':
      return { label: 'Ready', className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'SERVED':
      return { label: 'Served', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    case 'VOIDED':
      return { label: 'Voided', className: 'bg-red-100 text-red-800 border-red-200 line-through' };
    default:
      return { label: status, className: '' };
  }
}

export function OrderBuilder({ table, categories, promotions }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.id ?? ''
  );
  const [isQuickSale, setIsQuickSale] = useState(false);
  const [quickSalePayment, setQuickSalePayment] = useState<'CASH' | 'CARD_EXTERNAL' | null>(null);
  
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [notesItemId, setNotesItemId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const cart = useCartStore();

  // Set table and promotions context on mount
  useEffect(() => {
    // Reset cart when entering a table
    cart.reset();
    cart.setTable(table.id, table.name);
    cart.setPromotions(promotions as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id, table.name, promotions]);

  // Menu search: if searching, show results across all categories; else show active category
  const currentItems = menuSearch.trim()
    ? categories.flatMap((c) => c.items).filter((item) =>
        item.name.toLowerCase().includes(menuSearch.toLowerCase())
      )
    : categories.find((c) => c.id === activeCategory)?.items ?? [];

  const hasExistingOrder = !!table.currentOrder;
  const existingItems = table.currentOrder?.items ?? [];

  // Check if all items are served/voided (for Pay button)
  const allItemsComplete = hasExistingOrder && existingItems.length > 0 &&
    existingItems.every((i) => i.status === 'SERVED' || i.status === 'VOIDED');

  // Some items still have pending work
  const hasPendingOrReady = existingItems.some(
    (i) => i.status === 'PENDING' || i.status === 'READY'
  );

  const handleFireOrder = () => {
    if (cart.items.length === 0) {
      toast.error('Add items before firing');
      return;
    }

    startTransition(async () => {
      const result = await fireOrder({
        tableId: table.id,
        orderType: 'DINE_IN',
        userId: (session?.user as any)?.id ?? '',
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes,
        })),
      });

      if (result.success) {
        toast.success('Order fired to kitchen! 🔥');
        cart.reset();
        router.refresh(); // Refresh to show occupied status or transaction
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleAddToOrder = () => {
    if (!table.currentOrder || cart.items.length === 0) return;

    startTransition(async () => {
      const result = await addItemsToOrder({
        orderId: table.currentOrder!.id,
        userId: (session?.user as any)?.id ?? '',
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes,
        })),
      });

      if (result.success) {
        toast.success('Items added to order! 🔥');
        cart.reset();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleRemoveItem = (itemId: string) => {
    startTransition(async () => {
      const result = await removeOrderItem(itemId);
      if (result.success) {
        toast.success('Item removed');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleServeItem = (itemId: string) => {
    startTransition(async () => {
      const result = await serveItem(itemId);
      if (result.success) {
        toast.success('Item served ✓');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handlePayment = (method: 'CASH' | 'CARD_EXTERNAL') => {
    if (!table.currentOrder) return;

    startTransition(async () => {
      const result = await recordPayment(table.currentOrder!.id, method);
      if (result.success) {
        toast.success('Payment recorded ✓');
        setPaymentOpen(false);
        router.push('/pos');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handlePrintBill = () => {
    startTransition(async () => {
      const result = await printBill(table.id);
      if (result.success) {
        toast.success('Bill printed');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleVoidOrder = () => {
    if (!table.currentOrder) return;

    startTransition(async () => {
      const result = await voidOrder(table.currentOrder!.id);
      if (result.success) {
        toast.success('Order voided');
        router.push('/pos');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden">
      {/* Left: Menu Browser */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              cart.reset();
              router.push('/pos');
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{table.name}</h1>
            <p className="text-sm text-muted-foreground">
              {hasExistingOrder ? 'Active order — add items or manage' : 'New order'}
            </p>
          </div>
        </div>

        {/* Search */}
        {/* Search & Tabs Wrapper - Sticky */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 bg-muted"
                placeholder="Search menu items..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
              />
            </div>
          </div>

          {!menuSearch.trim() && (
            <div className="flex gap-2 p-4 pt-0 overflow-x-auto">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className="shrink-0"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 pb-32">
            {currentItems.map((item) => (
              <Card
                key={item.id}
                className={cn(
                  'cursor-pointer transition-all duration-150 active:scale-95',
                  'hover:bg-muted/50 border-border/50'
                )}
                onClick={() => cart.addItem(item)}
              >
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm leading-tight">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(item.basePrice)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart Panel */}
      <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-border flex flex-col bg-card max-h-[50vh] md:max-h-none overflow-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-lg">
            {hasExistingOrder ? 'Current Order' : 'New Order'}
          </h2>
        </div>

        {/* Existing Order Items with status + actions */}
        {hasExistingOrder && table.currentOrder && (
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Fired Items
            </h3>
            <div className="space-y-2">
              {existingItems.map((item) => {
                const badge = statusBadge(item.status);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between py-2 px-3 rounded-lg border',
                      item.status === 'VOIDED' && 'opacity-40',
                      item.status === 'SERVED' && 'bg-emerald-50 border-emerald-100',
                      item.status === 'READY' && 'bg-blue-50 border-blue-100',
                      item.status === 'PENDING' && 'bg-amber-50 border-amber-100',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium text-sm',
                          item.status === 'VOIDED' && 'line-through'
                        )}>
                          {item.quantity}× {item.menuItem.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0', badge.className)}
                        >
                          {badge.label}
                        </Badge>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {item.notes}
                        </p>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(item.frozenPrice * item.quantity)}
                      </span>
                    </div>

                    {/* Action buttons per status */}
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {/* READY → Serve button for floor staff */}
                      {item.status === 'READY' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-100"
                          onClick={() => handleServeItem(item.id)}
                          disabled={isPending}
                          title="Mark as Served"
                        >
                          <ConciergeBell className="w-4 h-4" />
                        </Button>
                      )}
                      {/* Remove button (PENDING or READY only) */}
                      {(item.status === 'PENDING' || item.status === 'READY') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:bg-red-100"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isPending}
                          title="Remove item"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {/* Served indicator */}
                      {item.status === 'SERVED' && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between font-semibold text-sm">
              <span>Order Total</span>
              <span>{formatCurrency(table.currentOrder.total)}</span>
            </div>
          </div>
        )}

        {/* New Cart Items (for both new orders and add-ons) */}
        <ScrollArea className="flex-1 p-4">
          {cart.items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Tap menu items to add
            </p>
          ) : (
            <div className="space-y-3">
              {hasExistingOrder && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                  New Items to Add
                </h3>
              )}
              {cart.items.map((item) => (
                <div key={item.menuItemId} className="space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {item.discount > 0 && (
                          <>
                            <span className="line-through">
                              {formatCurrency(item.basePrice)}
                            </span>
                            <span className="text-emerald-500">
                              {formatCurrency(item.effectivePrice)}
                            </span>
                          </>
                        )}
                        {item.discount === 0 && (
                          <span>{formatCurrency(item.basePrice)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          cart.updateQuantity(item.menuItemId, -1)
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          cart.updateQuantity(item.menuItemId, 1)
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => cart.removeItem(item.menuItemId)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Notes / Allergy input */}
                  <div className="flex items-center gap-1">
                    {item.notes ? (
                      <button
                        className="text-xs text-amber-600 flex items-center gap-1 hover:underline"
                        onClick={() => {
                          setNotesItemId(item.menuItemId);
                          setNotesValue(item.notes || '');
                        }}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {item.notes}
                      </button>
                    ) : (
                      <button
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                        onClick={() => {
                          setNotesItemId(item.menuItemId);
                          setNotesValue('');
                        }}
                      >
                        <MessageSquare className="w-3 h-3" />
                        Add note / allergy
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Totals & Actions */}
        <div className="border-t border-border p-4 space-y-3">
          {cart.items.length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(cart.subtotal)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-emerald-500">
                  <span>Discount</span>
                  <span>-{formatCurrency(cart.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Tax (7%)</span>
                <span>{formatCurrency(cart.tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatCurrency(cart.total)}</span>
              </div>
            </div>
          )}

          {/* New order: Fire button */}
          {!hasExistingOrder && (
            <Button
              className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700 text-white"
              onClick={handleFireOrder}
              disabled={isPending || cart.items.length === 0}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Flame className="w-5 h-5" />
                  FIRE ORDER
                </span>
              )}
            </Button>
          )}

          {/* Existing order actions */}
          {hasExistingOrder && (
            <div className="space-y-2">
              {/* Add-on button (when cart has items) */}
              {cart.items.length > 0 && (
                <Button
                  className="w-full h-12 text-base font-bold bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleAddToOrder}
                  disabled={isPending}
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      ADD TO ORDER
                    </span>
                  )}
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handlePrintBill}
                  disabled={isPending}
                >
                  <FileText className="w-4 h-4" />
                  Print Bill
                </Button>
                <Button
                  className={cn(
                    'gap-2',
                    allItemsComplete
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                  onClick={() => allItemsComplete && setPaymentOpen(true)}
                  disabled={isPending || !allItemsComplete}
                  title={
                    !allItemsComplete
                      ? 'All items must be served or voided before payment'
                      : 'Record payment'
                  }
                >
                  <Banknote className="w-4 h-4" />
                  Pay
                </Button>
                <Button
                  variant="destructive"
                  className="col-span-2 gap-2"
                  onClick={handleVoidOrder}
                  disabled={isPending}
                >
                  <XCircle className="w-4 h-4" />
                  Void Order
                </Button>
              </div>

              {/* Pay requirement hint */}
              {hasPendingOrReady && (
                <p className="text-xs text-muted-foreground text-center">
                  All items must be served before payment
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-3xl font-bold">
              {formatCurrency(table.currentOrder?.total ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Order for {table.name}
            </p>
          </div>
          <DialogFooter className="flex gap-3 sm:justify-center">
            <Button
              size="lg"
              className="flex-1 gap-2 h-16 text-lg"
              variant="outline"
              onClick={() => handlePayment('CASH')}
              disabled={isPending}
            >
              <Banknote className="w-6 h-6" />
              Cash
            </Button>
            <Button
              size="lg"
              className="flex-1 gap-2 h-16 text-lg"
              variant="outline"
              onClick={() => handlePayment('CARD_EXTERNAL')}
              disabled={isPending}
            >
              <CreditCard className="w-6 h-6" />
              Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes / Allergy Dialog */}
      <Dialog
        open={notesItemId !== null}
        onOpenChange={(open) => {
          if (!open) setNotesItemId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Item Notes / Allergies
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <Input
              placeholder="e.g. No nuts, gluten-free, extra spicy..."
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {['No nuts', 'Gluten-free', 'Dairy-free', 'Extra spicy', 'No onions'].map(
                (tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 text-xs"
                    onClick={() =>
                      setNotesValue((prev) =>
                        prev ? `${prev}, ${tag}` : tag
                      )
                    }
                  >
                    {tag}
                  </Badge>
                )
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (notesItemId) {
                  cart.setNotes(notesItemId, '');
                }
                setNotesItemId(null);
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                if (notesItemId) {
                  cart.setNotes(notesItemId, notesValue);
                }
                setNotesItemId(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
