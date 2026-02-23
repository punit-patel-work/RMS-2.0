'use client';

import { useState } from 'react';
import { useCustomerCartStore } from '@/stores/customer-cart-store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';

export function CustomerCartDrawer() {
  const [open, setOpen] = useState(false);
  const cart = useCustomerCartStore();
  const router = useRouter();
  
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-9 px-4 gap-2">
          <ShoppingCart className="w-4 h-4" />
          <span className="hidden sm:inline font-semibold">Cart</span>
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b bg-muted/20">
          <SheetTitle>Your Order</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1 p-4">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-4">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>Your cart is empty.</p>
              <Button variant="outline" onClick={() => setOpen(false)}>Browse Menu</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.items.map(item => (
                 <div key={item.id} className="flex flex-col gap-2 p-3 border rounded-lg bg-card shadow-sm">
                   <div className="flex justify-between items-start">
                     <div>
                       <h4 className="font-semibold text-sm leading-tight">{item.name}</h4>
                       {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                         <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                           {item.selectedModifiers.map(m => m.name).join(', ')}
                         </p>
                       )}
                     </div>
                     <span className="font-bold text-sm shrink-0 ml-4">{formatCurrency(item.effectivePrice * item.quantity)}</span>
                   </div>
                   <div className="flex justify-between items-center mt-1">
                     <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => cart.updateQuantity(item.id, -1)}>
                           <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => cart.updateQuantity(item.id, 1)}>
                           <Plus className="w-3 h-3" />
                        </Button>
                     </div>
                     <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => cart.removeItem(item.id)}>
                        <Trash2 className="w-3 h-3" />
                     </Button>
                   </div>
                 </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {cart.items.length > 0 && (
          <div className="p-4 border-t bg-card space-y-4 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)] z-10">
            <div className="space-y-1.5 text-sm">
               <div className="flex justify-between text-muted-foreground text-xs">
                 <span>Subtotal</span>
                 <span>{formatCurrency(cart.subtotal)}</span>
               </div>
               {cart.discount > 0 && (
                 <div className="flex justify-between text-emerald-600 font-medium text-xs">
                   <span>Discount</span>
                   <span>-{formatCurrency(cart.discount)}</span>
                 </div>
               )}
               <div className="flex justify-between font-bold text-lg pt-2 border-t mt-1">
                 <span>Total</span>
                 <span>{formatCurrency(cart.total)}</span>
               </div>
            </div>
            <Button 
              className="w-full gap-2 py-6 text-lg shadow-sm" 
              onClick={() => {
                setOpen(false);
                router.push('/order/checkout');
              }}
            >
              Checkout <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
