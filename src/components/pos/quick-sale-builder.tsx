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
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Banknote,
  CreditCard,
  Search,
  Check,
  Zap
} from 'lucide-react';
import { useCartStore } from '@/stores/cart-store';
import { fireOrder } from '@/server/actions/order.actions';
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

export function QuickSaleBuilder({ categories, promotions }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.id ?? ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD_EXTERNAL'>('CASH');
  const [menuSearch, setMenuSearch] = useState('');
  const cart = useCartStore();

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

  const handleFireQuickSale = () => {
    if (cart.items.length === 0) {
      toast.error('Add items before completing sale');
      return;
    }

    startTransition(async () => {
      const result = await fireOrder({
        orderType: 'QUICK_SALE',
        userId: (session?.user as any)?.id ?? '',
        paymentMethod: paymentMethod,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes,
        })),
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
                onClick={() => cart.addItem(item)}
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

      {/* Right: Cart & Payment */}
      <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-border bg-card flex flex-col shadow-xl z-20 max-h-[45vh] md:max-h-none">
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
                <div key={item.menuItemId} className="flex gap-2 bg-background p-3 rounded-lg border border-border shadow-sm">
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          <span className="font-semibold text-sm">
                              {formatCurrency(item.effectivePrice * item.quantity)}
                          </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center border rounded-md bg-muted/50 h-7">
                              <button 
                                className="px-2 hover:bg-muted text-lg leading-none h-full flex items-center"
                                onClick={() => cart.updateQuantity(item.menuItemId, -1)}
                              >−</button>
                              <span className="px-1 text-sm font-medium min-w-[1.2rem] text-center">{item.quantity}</span>
                              <button 
                                className="px-2 hover:bg-muted text-lg leading-none h-full flex items-center"
                                onClick={() => cart.updateQuantity(item.menuItemId, 1)}
                              >+</button>
                          </div>
                          <button 
                             className="ml-auto text-destructive hover:bg-destructive/10 p-1 rounded"
                             onClick={() => cart.removeItem(item.menuItemId)}
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
           </div>
           
           <div className="flex justify-between text-xl font-bold border-t border-border pt-2">
             <span>Total</span>
             <span>{formatCurrency(cart.total)}</span>
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
    </div>
  );
}
