'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Banknote,
  CreditCard,
  Search,
  Check,
  Zap,
  UserPlus,
  Gift,
  ShoppingBag,
} from 'lucide-react';
import { useCartStore, useCartHydrated } from '@/stores/cart-store';
import { fireOrder } from '@/server/actions/order.actions';
import { verifyCustomer, registerCustomer } from '@/server/actions/crm.actions';
import { formatCurrency } from '@/lib/pricing';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Promotion, MenuItem, Category } from '@/generated/prisma/client';
import { ModifierSelector } from '@/components/pos/modifier-selector';

type CategoryWithItems = Category & {
  items: MenuItem[];
};

interface Props {
  categories: CategoryWithItems[];
  promotions: Promotion[];
}

export function QuickSaleBuilder({ categories, promotions }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.id ?? ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD_EXTERNAL'>('CASH');
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

  const maxRedeemablePoints = customerData ? Math.min(customerData.pointsBalance, Math.ceil(cart.total / 0.1)) : 0;
  const pointsToRedeem = usePoints ? maxRedeemablePoints : 0;
  const displayTotal = Math.max(0, cart.total - (pointsToRedeem * 0.1));

  const hydrated = useCartHydrated();
  // Wait for persist hydration before deciding to reset, otherwise we wipe
  // the cart we just persisted.
  useEffect(() => {
    if (!hydrated) return;
    const currentCartTable = useCartStore.getState().tableId;
    if (currentCartTable !== 'quick-sale') {
      cart.reset();
      cart.setTable('quick-sale', 'Quick Sale');
    }
    cart.setPromotions(promotions as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, promotions]);

  // Menu search: cross-category when searching
  const currentItems = menuSearch.trim()
    ? categories.flatMap((c) => c.items).filter((item) =>
        item.name.toLowerCase().includes(menuSearch.toLowerCase())
      )
    : categories.find((c) => c.id === activeCategory)?.items ?? [];

  const handleFireQuickSale = () => {
    if (cart.items.length === 0) {
      toast.error('Add items before completing sale');
      return;
    }

    startTransition(async () => {
      const result = await fireOrder({
        orderType: 'QUICK_SALE',
        userId: session?.user?.id ?? '',
        paymentMethod: paymentMethod,
        pointsToRedeem,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes,
        })),
        customerId: customerData?.id,
      });

      if (result.success) {
        toast.success(`Quick Sale Completed! (${paymentMethod}) ⚡`);
        cart.reset();
        router.refresh(); // Refresh (though usually stays on same page for next sale)
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
    <div className={cn("flex flex-col bg-card overflow-auto shadow-xl z-20", isMobileClassName)}>
            <div className="p-4 border-b border-border bg-background flex justify-between items-center">
                <h2 className="font-bold text-lg">Current Sale</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => cart.reset()}
                  disabled={cart.items.length === 0}
                >
                  Clear
                </Button>
            </div>
    
            <ScrollArea className="flex-1 p-4 bg-muted/10">
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 md:h-full text-muted-foreground gap-2 opacity-50">
                  <Zap className="w-12 h-12" />
                  <p>No items added</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex gap-2 bg-background p-3 rounded-lg border border-border shadow-sm">
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                              <span className="font-medium text-sm truncate">{item.name}</span>
                              <span className="font-semibold text-sm">
                                  {formatCurrency(item.effectivePrice * item.quantity)}
                              </span>
                          </div>
                          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                            <p className="text-xs text-muted-foreground leading-tight mt-0.5 mb-1">
                              {item.selectedModifiers.map(m => m.name).join(', ')}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center border rounded-md bg-muted/50 h-7">
                                  <button 
                                    className="px-2 hover:bg-muted text-lg leading-none h-full flex items-center"
                                    onClick={() => cart.updateQuantity(item.id, -1)}
                                  >−</button>
                                  <span className="px-1 text-sm font-medium min-w-[1.2rem] text-center">{item.quantity}</span>
                                  <button 
                                    className="px-2 hover:bg-muted text-lg leading-none h-full flex items-center"
                                    onClick={() => cart.updateQuantity(item.id, 1)}
                                  >+</button>
                              </div>
                              <button 
                                 className="ml-auto text-destructive hover:bg-destructive/10 p-1 rounded"
                                 onClick={() => cart.removeItem(item.id)}
                              >
                                 <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
    
            {/* Payment Section */}
            <div className="border-t border-border p-4 bg-background space-y-3">
               {/* Loyalty Button */}
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
    
               <Separator />
    
               {/* Totals */}
               <div className="space-y-1 pb-2">
                 <div className="flex justify-between text-sm text-muted-foreground">
                   <span>Subtotal</span>
                   <span>{formatCurrency(cart.subtotal)}</span>
                 </div>
                 {cart.discount > 0 && (
                   <div className="flex justify-between text-sm text-emerald-600">
                     <span>Discount</span>
                     <span>-{formatCurrency(cart.discount)}</span>
                   </div>
                 )}
                 <div className="flex justify-between text-sm text-muted-foreground">
                   <span>Tax (7%)</span>
                   <span>{formatCurrency(cart.tax)}</span>
                 </div>
                 {pointsToRedeem > 0 && (
                   <div className="flex justify-between text-sm text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded mt-1">
                     <span>Points ({pointsToRedeem})</span>
                     <span>-{formatCurrency(pointsToRedeem * 0.1)}</span>
                   </div>
                 )}
               </div>
               
               <div className="flex justify-between text-xl font-bold border-t border-border pt-2">
                 <span>Total</span>
                 <span>{formatCurrency(displayTotal)}</span>
               </div>
    
               {/* Payment Method Selector */}
               <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                    className={cn(
                        "h-10 border-2",
                        paymentMethod === 'CASH' ? "border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-100" : "hover:border-emerald-200"
                    )}
                    onClick={() => setPaymentMethod('CASH')}
                  >
                      <Banknote className="w-4 h-4 mr-2" />
                      Cash
                  </Button>
                  <Button
                    variant={paymentMethod === 'CARD_EXTERNAL' ? 'default' : 'outline'}
                    className={cn(
                        "h-10 border-2",
                        paymentMethod === 'CARD_EXTERNAL' ? "border-purple-600 bg-purple-50 text-purple-900 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-100" : "hover:border-purple-200"
                    )}
                    onClick={() => setPaymentMethod('CARD_EXTERNAL')}
                  >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Card
                  </Button>
               </div>
    
               {/* Confirm Button */}
               <Button
                 className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20"
                 disabled={isPending || cart.items.length === 0}
                 onClick={handleFireQuickSale}
               >
                 {isPending ? (
                   'Processing...'
                 ) : (
                   <>
                     Pay & Complete
                     <Check className="w-5 h-5 ml-2" />
                   </>
                 )}
               </Button>
            </div>
          </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden">
      {/* Left: Menu Browser */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-4 bg-background">
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
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Quick Sale</h1>
              <p className="text-sm text-muted-foreground">
                Immediate Payment
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
                placeholder="Search menu..."
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
                  className={cn(
                    'shrink-0',
                    activeCategory === cat.id ? 'bg-blue-600 hover:bg-blue-700' : ''
                  )}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-32 md:pb-4">
            {currentItems.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-95 border-border/60 shadow-sm"
                onClick={() => {
                  if ((item as any).modifierGroups && (item as any).modifierGroups.length > 0) {
                    setModifyingItem(item);
                  } else {
                    cart.addItem(item);
                  }
                }}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                      {item.name}
                    </h3>
                    <span className="font-bold text-blue-600 text-sm">
                      {formatCurrency(item.basePrice)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart Panel (Desktop) */}
      {renderCartPanel("hidden md:flex flex-col w-96 border-l border-border h-full")}

      {/* Floating Sticky Bar (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="w-full h-14 text-lg font-bold flex justify-between items-center px-6 shadow-lg shadow-primary/20 bg-blue-600 hover:bg-blue-700">
              <span className="flex items-center gap-2">
                 <ShoppingBag className="w-5 h-5" />
                 {cart.items.length > 0 ? `${cart.items.length} items` : 'Empty Cart'}
              </span>
              <span>{formatCurrency(displayTotal)}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col pt-6 z-50">
            <SheetHeader className="px-4 pb-2 border-b text-left shrink-0">
              <SheetTitle>Quick Sale Checkout</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden flex flex-col">
               {renderCartPanel("flex flex-col h-full w-full border-none shadow-none")}
            </div>
          </SheetContent>
        </Sheet>
      </div>

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
                {customerData.pointsBalance > 0 && maxRedeemablePoints > 0 && (
                   <Button 
                      variant={usePoints ? "default" : "outline"}
                      className="w-full mt-4"
                      onClick={() => setUsePoints(!usePoints)}
                   >
                       {usePoints ? "Remove Point Redemption" : `Redeem ${maxRedeemablePoints} points for -${formatCurrency(maxRedeemablePoints * 0.1)}`}
                   </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {loyaltyStatus === 'found' ? (
              <Button onClick={() => setLoyaltyOpen(false)} className="w-full bg-blue-600 hover:bg-blue-700">
                Attach to Sale
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
