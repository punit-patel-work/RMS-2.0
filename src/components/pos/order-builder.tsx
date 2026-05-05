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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
  UserPlus,
  Gift,
  ShoppingBag,
} from 'lucide-react';
import { useCartStore, useCartHydrated } from '@/stores/cart-store';
import {
  fireOrder,
  addItemsToOrder,
  removeOrderItem,
  serveItem,
  recordPayment,
  printBill,
  voidOrder,
} from '@/server/actions/order.actions';
import { verifyCustomer, registerCustomer } from '@/server/actions/crm.actions';
import { formatCurrency } from '@/lib/pricing';
import { CartLineItem } from '@/components/pos/cart-line-item';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Promotion, MenuItem, Category } from '@/generated/prisma/client';
import { ModifierSelector } from '@/components/pos/modifier-selector';

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
  status: 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED';
  currentOrder?: {
    id: string;
    total: number;
    subtotal: number;
    discount: number;
    amountPaid: number;
    paymentMethod: string | null;
    items: OrderItemData[];
  } | null;
  // Optional: getTableById doesn't include reservations (only the table-grid
  // page does). Make this optional so single-table page renders work too.
  reservations?: {
    id: string;
    guestName: string;
    reservedAt: Date | string;
    reservedUntil: Date | string;
  }[];
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
  const [splitAmountStr, setSplitAmountStr] = useState('');
  const [notesItemId, setNotesItemId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [modifyingItem, setModifyingItem] = useState<any | null>(null);

  // CRM / Loyalty State
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [loyaltyStatus, setLoyaltyStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'registering'>('idle');
  const [usePoints, setUsePoints] = useState(false);

  const cart = useCartStore();
  const hydrated = useCartHydrated();

  // Wait for persist hydration to finish before we decide whether to reset.
  // Otherwise the very first mount sees `getState().tableId === null` (the
  // initial pre-hydration value), thinks we've switched tables, and wipes
  // the cart you just left to check the KDS for.
  useEffect(() => {
    if (!hydrated) return;
    const currentCartTable = useCartStore.getState().tableId;
    if (currentCartTable !== table.id) {
      cart.reset();
      cart.setTable(table.id, table.name);
    }
    // Promotions are reapplied every mount because they're not persisted —
    // this re-runs cart recalc with the freshest promo set.
    cart.setPromotions(promotions as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, table.id, table.name, promotions]);

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

  const targetTotal = table.currentOrder ? (table.currentOrder.total - table.currentOrder.amountPaid) : cart.total;
  const maxRedeemablePoints = customerData ? Math.min(customerData.pointsBalance, Math.ceil(targetTotal / 0.1)) : 0;
  const pointsToRedeem = usePoints ? maxRedeemablePoints : 0;

  const handleFireOrder = () => {
    if (cart.items.length === 0) {
      toast.error('Add items before firing');
      return;
    }
    startTransition(async () => {
      const res = await fireOrder({
        tableId: table.id,
        userId: session?.user?.id ?? '',
        orderType: 'DINE_IN',
        pointsToRedeem,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes,
          selectedModifiers: i.selectedModifiers,
        })),
        customerId: customerData?.id,
      });
      if (res.success) {
        toast.success('Order fired to kitchen! 🔥');
        cart.reset();
        router.refresh(); // Refresh to show occupied status or transaction
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleAddToOrder = () => {
    if (!table.currentOrder || cart.items.length === 0) return;

    startTransition(async () => {
      const result = await addItemsToOrder({
        orderId: table.currentOrder!.id,
        userId: session?.user?.id ?? '',
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

    // F-M17: re-derive remaining from the latest props at the moment of the
    // click (rather than capturing earlier in render) AND defer to the server's
    // own balance-owing cap inside recordPayment for the source of truth.
    // If the customer or pointsToRedeem changes mid-dialog, we always use the
    // freshest values here, and the server still rejects over-payment even if
    // the client somehow sends stale numbers.
    const order = table.currentOrder;
    const remaining = order.total - order.amountPaid;
    const remainingAfterPoints = Math.max(0, remaining - pointsToRedeem * 0.1);
    let payAmt = remainingAfterPoints;

    if (splitAmountStr) {
      const parsed = parseFloat(splitAmountStr);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error('Invalid payment amount');
        return;
      }
      if (parsed > remainingAfterPoints + 0.005) {
        toast.error('Payment exceeds remaining balance');
        return;
      }
      payAmt = Math.min(parsed, remainingAfterPoints);
    }

    startTransition(async () => {
      // Pass the pointsToRedeem and customerId to correctly record payment with point discounts
      const result = await recordPayment(table.currentOrder!.id, method, payAmt, pointsToRedeem, customerData?.id);
      if (result.success) {
        toast.success(`Paid ${formatCurrency(payAmt)} ✓`);
        setSplitAmountStr('');
        // If the paid amount covers the remaining, close payment dialog
        // This logic might need refinement based on actual backend remaining balance
        if (payAmt >= remainingAfterPoints) { 
          setPaymentOpen(false);
          setUsePoints(false); // reset points usage for next payment
          router.push('/pos'); 
        }
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

    // U-C3: voiding wipes revenue and inventory deductions — require an
    // explicit confirm with a reason for audit trail. The reason isn't
    // currently persisted on the Order (would need a schema field), but
    // capturing it here makes the console.log traceable and prevents the
    // accidental "I clicked the wrong button" voids that had no friction.
    const reason = window.prompt(
      'Void this order?\n\nReason (required, e.g. "duplicate", "customer left", "wrong item"):'
    );
    if (reason === null) return; // user cancelled
    if (!reason.trim()) {
      toast.error('Void requires a reason');
      return;
    }

    startTransition(async () => {
      const result = await voidOrder(table.currentOrder!.id);
      if (result.success) {
        // Log reason for audit until a proper voidReason column lands.
        console.info(`[VOID] order=${table.currentOrder!.id} reason="${reason.trim()}"`);
        toast.success('Order voided');
        router.push('/pos');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSearchCustomer = async () => {
    if (!customerPhone.trim() || customerPhone.length < 5) return;
    setLoyaltyStatus('loading');
    const res = await verifyCustomer(customerPhone.trim());
    if (res.success) {
      setCustomerData(res.customer);
      setLoyaltyStatus('found');
    } else {
      setCustomerData(null);
      setLoyaltyStatus('not_found');
    }
  };

  const handleRegisterCustomer = async () => {
    setLoyaltyStatus('registering');
    const res = await registerCustomer(customerPhone.trim(), customerNameInput.trim() || undefined);
    if (res.success) {
      setCustomerData(res.customer);
      setLoyaltyStatus('found');
      toast.success('Customer registered!');
    } else {
      setLoyaltyStatus('not_found');
      toast.error(res.error);
    }
  };


  const renderCartPanel = (isMobileClassName?: string) => (
    
          <div className={cn("flex flex-col bg-card overflow-auto", isMobileClassName)}>
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
                    <CartLineItem
                      key={item.id}
                      item={item}
                      onDecrement={() => cart.updateQuantity(item.id, -1)}
                      onIncrement={() => {
                        const originalItem = currentItems.find((i) => i.id === item.menuItemId) || categories.flatMap(c => c.items).find(i => i.id === item.menuItemId);
                        const maxQty = (originalItem && originalItem.trackStock) ? originalItem.stockQuantity : Infinity;
                        if (item.quantity >= maxQty) {
                          toast.error(`Maximum stock reached`);
                          return;
                        }
                        cart.updateQuantity(item.id, 1);
                      }}
                      onRemove={() => cart.removeItem(item.id)}
                      onEditNotes={() => {
                        setNotesItemId(item.id);
                        setNotesValue(item.notes || '');
                      }}
                    />
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
    
              {/* Loyalty Section (Before Fire Order) */}
              {!hasExistingOrder && (
                <div className="mb-2">
                  <Button
                    variant={customerData ? 'secondary' : 'outline'}
                    className="w-full justify-between h-12"
                    onClick={() => setLoyaltyOpen(true)}
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      {customerData ? (
                        <span className="font-semibold text-blue-600">{customerData.name || customerData.phone}</span>
                      ) : (
                        <span>Attach Customer / Loyalty</span>
                      )}
                    </div>
                    {customerData && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        {customerData.pointsBalance} pts
                      </Badge>
                    )}
                  </Button>
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
  );

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
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
                onClick={() => {
                  const maxQty = item.trackStock ? item.stockQuantity : Infinity;
                  const currentQty = cart.items.find((i) => i.menuItemId === item.id)?.quantity || 0;
                  
                  if (currentQty >= maxQty) {
                    toast.error(`Out of stock! Only ${maxQty} available.`);
                    return;
                  }

                  if ((item as any).modifierGroups && (item as any).modifierGroups.length > 0) {
                    setModifyingItem(item);
                  } else {
                    cart.addItem(item);
                  }
                }}
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

      {/* Right: Cart Panel (Desktop) */}
      {/* U-H2: was fixed w-80 lg:w-96 which overflowed on narrower laptops.
          Use a width-clamped flex column that grows with content but never
          exceeds 24rem on desktop. */}
      {renderCartPanel("hidden md:flex flex-col w-full max-w-sm lg:max-w-md border-l border-border h-full shrink-0")}

      {/* Floating Sticky Bar (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="w-full h-14 text-lg font-bold flex justify-between items-center px-6 shadow-lg shadow-primary/20">
              <span className="flex items-center gap-2">
                 <ShoppingBag className="w-5 h-5" />
                 {cart.items.length > 0 ? `${cart.items.length} items` : 'Empty Cart'}
              </span>
              <span>{formatCurrency(table.currentOrder ? table.currentOrder.total : cart.total)}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col pt-6 z-50">
            <SheetHeader className="px-4 pb-2 border-b text-left shrink-0">
              <SheetTitle>Your Order</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden flex flex-col">
               {renderCartPanel("flex flex-col h-full w-full border-none")}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 text-center">
            <div className="flex justify-between text-sm px-4">
              <span className="text-muted-foreground">Order Total:</span>
              <span className="font-semibold">{formatCurrency(table.currentOrder?.total ?? 0)}</span>
            </div>
            
            {(table.currentOrder?.amountPaid || 0) > 0 && (
              <div className="flex justify-between text-sm px-4 text-emerald-600">
                <span>Amount Paid:</span>
                <span className="font-semibold">-{formatCurrency(table.currentOrder!.amountPaid)}</span>
              </div>
            )}
            
            <Separator />
            
            <div className="flex justify-between text-lg px-4 font-bold">
              <span>Remaining:</span>
              <span>{formatCurrency(Math.max(0, (table.currentOrder?.total ?? 0) - (table.currentOrder?.amountPaid ?? 0) - (pointsToRedeem * 0.1)))}</span>
            </div>

            {customerData && (
              <div className="mx-4 mt-2 mb-2 p-3 border border-blue-200 bg-blue-50 rounded-lg flex flex-col items-center">
                 <div className="flex justify-between w-full items-center mb-2 text-sm text-blue-900">
                    <div className="flex gap-2 items-center">
                       <Gift className="w-4 h-4" />
                       <span className="font-semibold">{customerData.name || 'Customer'}</span>
                    </div>
                    <span className="font-bold">{customerData.pointsBalance} pts</span>
                 </div>
                 {customerData.pointsBalance > 0 && maxRedeemablePoints > 0 && (
                    <Button 
                       variant={usePoints ? "default" : "outline"}
                       size="sm"
                       className={cn("w-full h-8", usePoints ? "bg-blue-600 text-white" : "border-blue-300 text-blue-700 hover:bg-blue-100")}
                       onClick={() => setUsePoints(!usePoints)}
                    >
                       {usePoints ? "Points Applied!" : `Redeem ${maxRedeemablePoints} pts for -${formatCurrency(maxRedeemablePoints * 0.1)}`}
                    </Button>
                 )}
              </div>
            )}
            
            {!customerData && (
                <Button variant="ghost" className="w-full text-blue-600 h-8" onClick={() => { setPaymentOpen(false); setLoyaltyOpen(true); }}>
                   Attach Loyalty / Customer Before Paying
                </Button>
            )}

            <div className="px-4 text-left">
              <label className="text-sm font-semibold mb-1 block">Custom Amount (Split Check)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.max(0, (table.currentOrder?.total ?? 0) - (table.currentOrder?.amountPaid || 0) - (pointsToRedeem * 0.1))}
                  placeholder="Leave empty to pay full remaining"
                  value={splitAmountStr}
                  onChange={(e) => setSplitAmountStr(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border rounded-md"
                />
              </div>
            </div>
            
            <p className="text-sm text-amber-600 mt-2 font-medium">
              Order stays open until fully paid or cleared
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

      <ModifierSelector
        item={modifyingItem}
        modifierGroups={modifyingItem?.modifierGroups || []}
        onCancel={() => setModifyingItem(null)}
        onConfirm={(itemToCart, mods) => {
          cart.addItem(itemToCart, mods);
          setModifyingItem(null);
        }}
      />

      {/* Loyalty / Customer Dialog */}
      <Dialog open={loyaltyOpen} onOpenChange={setLoyaltyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Customer Loyalty</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Phone Number</label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="e.g. 555-1234"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setLoyaltyStatus('idle');
                  }}
                />
                <Button onClick={handleSearchCustomer} disabled={loyaltyStatus === 'loading' || !customerPhone.trim()}>
                  {loyaltyStatus === 'loading' ? '...' : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {(loyaltyStatus === 'not_found' || loyaltyStatus === 'registering') && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <p className="text-sm font-medium">Customer not found. Create new?</p>
                <Input
                  placeholder="Customer Name (Optional)"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                />
                <Button onClick={handleRegisterCustomer} className="w-full" disabled={loyaltyStatus === 'registering'}>
                  {loyaltyStatus === 'registering' ? 'Registering...' : 'Register Customer'}
                </Button>
              </div>
            )}

            {loyaltyStatus === 'found' && customerData && (
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-center space-y-2">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Gift className="w-6 h-6" />
                </div>
                <p className="font-semibold text-lg">{customerData.name || customerData.phone}</p>
                <div className="inline-block bg-white px-3 py-1 rounded-full shadow-sm border text-sm font-bold text-blue-600">
                  {customerData.pointsBalance} Points Available
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {loyaltyStatus === 'found' ? (
              <Button onClick={() => setLoyaltyOpen(false)} className="w-full bg-blue-600 hover:bg-blue-700">
                Attach to Order
              </Button>
            ) : (
              <Button onClick={() => setLoyaltyOpen(false)} variant="ghost" className="w-full">
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
