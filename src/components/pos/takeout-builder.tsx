'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Banknote,
  CreditCard,
  Clock,
  Package,
  MessageSquare,
  User,
  Phone,
  Search,
  Calendar,
} from 'lucide-react';
import { useCartStore } from '@/stores/cart-store';
import { fireOrder, recordPayment } from '@/server/actions/order.actions';
import { formatCurrency } from '@/lib/pricing';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Promotion, MenuItem, Category } from '@/generated/prisma/client';

type CategoryWithItems = Category & {
  items: MenuItem[];
};

interface Props {
  categories: CategoryWithItems[];
  promotions: Promotion[];
}

export function TakeoutBuilder({ categories, promotions }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.id ?? ''
  );
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD_EXTERNAL' | 'LATER_PAY' | null>(null);
  const [notesItemId, setNotesItemId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const cart = useCartStore();

  // Set promotions on mount
  // Set promotions on mount and reset cart
  useEffect(() => {
    cart.reset();
    cart.setPromotions(promotions as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotions]);

  // Menu search: cross-category when searching
  const currentItems = menuSearch.trim()
    ? categories.flatMap((c) => c.items).filter((item) =>
        item.name.toLowerCase().includes(menuSearch.toLowerCase())
      )
    : categories.find((c) => c.id === activeCategory)?.items ?? [];

  const handleFireTakeout = () => {
    if (cart.items.length === 0) {
      toast.error('Add items before placing order');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    startTransition(async () => {
      const result = await fireOrder({
        orderType: 'TAKEOUT',
        userId: (session?.user as any)?.id ?? '',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes,
        })),
        scheduledAt: scheduleDate && scheduleTime
          ? new Date(`${scheduleDate}T${scheduleTime}`)
          : undefined,
      });

      if (result.success) {
        // If LATER_PAY, record deferred payment
        if (paymentMethod === 'LATER_PAY') {
          await recordPayment(result.orderId!, 'LATER_PAY');
          toast.success('Takeout order placed! Payment on pickup 📦');
        } else {
          await recordPayment(result.orderId!, paymentMethod);
          toast.success('Takeout order placed & paid! 📦');
        }

        cart.reset();
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Takeout Order</h1>
              <p className="text-sm text-muted-foreground">
                Phone / walk-in takeout
              </p>
            </div>
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
        {/* Customer Info */}
        <div className="p-4 border-b border-border space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-500" />
            Takeout Details
          </h2>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <User className="w-3 h-3" /> Customer Name *
              </Label>
              <Input
                placeholder="John Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone Number
              </Label>
              <Input
                placeholder="(555) 123-4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            {/* Scheduled Pickup */}
            <div className="space-y-1 pt-1">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Scheduled Pickup (optional)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
              {scheduleDate && scheduleTime && (
                <p className="text-xs text-violet-600">
                  📅 Pickup: {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 p-4">
          {cart.items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Tap menu items to add
            </p>
          ) : (
            <div className="space-y-3">
              {cart.items.map((item) => (
                <div key={item.menuItemId} className="space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {item.discount > 0 ? (
                          <>
                            <span className="line-through">
                              {formatCurrency(item.basePrice)}
                            </span>
                            <span className="text-emerald-500">
                              {formatCurrency(item.effectivePrice)}
                            </span>
                          </>
                        ) : (
                          <span>{formatCurrency(item.basePrice)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => cart.updateQuantity(item.menuItemId, -1)}
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
                        onClick={() => cart.updateQuantity(item.menuItemId, 1)}
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
                  {/* Notes */}
                  <button
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                    onClick={() => {
                      setNotesItemId(item.menuItemId);
                      setNotesValue(item.notes || '');
                    }}
                  >
                    <MessageSquare className="w-3 h-3" />
                    {item.notes || 'Add note / allergy'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Totals & Payment */}
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

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Payment Method
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                size="sm"
                className="gap-1 h-10"
                onClick={() => setPaymentMethod('CASH')}
              >
                <Banknote className="w-3.5 h-3.5" />
                Cash
              </Button>
              <Button
                variant={paymentMethod === 'CARD_EXTERNAL' ? 'default' : 'outline'}
                size="sm"
                className="gap-1 h-10"
                onClick={() => setPaymentMethod('CARD_EXTERNAL')}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Card
              </Button>
              <Button
                variant={paymentMethod === 'LATER_PAY' ? 'default' : 'outline'}
                size="sm"
                className="gap-1 h-10"
                onClick={() => setPaymentMethod('LATER_PAY')}
              >
                <Clock className="w-3.5 h-3.5" />
                Later
              </Button>
            </div>
            {paymentMethod === 'LATER_PAY' && (
              <p className="text-xs text-amber-600">
                ⚠️ Payment will be collected on pickup/handover
              </p>
            )}
          </div>

          <Button
            className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleFireTakeout}
            disabled={isPending || cart.items.length === 0}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Placing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Flame className="w-5 h-5" />
                PLACE TAKEOUT ORDER
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Notes Dialog */}
      <Dialog
        open={notesItemId !== null}
        onOpenChange={(open) => { if (!open) setNotesItemId(null); }}
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
                      setNotesValue((prev) => prev ? `${prev}, ${tag}` : tag)
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
                if (notesItemId) cart.setNotes(notesItemId, '');
                setNotesItemId(null);
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                if (notesItemId) cart.setNotes(notesItemId, notesValue);
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
