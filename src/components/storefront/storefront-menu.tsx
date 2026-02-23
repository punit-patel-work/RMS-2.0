'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/pricing';
import { ModifierSelector } from '@/components/pos/modifier-selector';
import { useCustomerCartStore } from '@/stores/customer-cart-store';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface StorefrontMenuProps {
  categories: any[];
}

export function StorefrontMenu({ categories }: StorefrontMenuProps) {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const cart = useCustomerCartStore();

  const handleAddToCart = (item: any, selectedModifiers: any[]) => {
    cart.addItem(item, selectedModifiers);
    setSelectedItem(null);
    toast.success(`Added ${item.name} to cart`);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-12 max-w-5xl">
      {categories.map((category) => {
        if (!category.items || category.items.length === 0) return null;

        return (
          <section key={category.id} id={`category-${category.id}`} className="space-y-6">
            <div className="border-b pb-2">
              <h2 className="text-2xl font-bold tracking-tight">{category.name}</h2>
              {category.description && (
                <p className="text-muted-foreground mt-1">{category.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {category.items.map((item: any) => (
                <Card 
                  key={item.id} 
                  className="flex flex-col overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-card border-border/50"
                  onClick={() => setSelectedItem(item)}
                >
                  {item.imageUrl ? (
                    <div className="aspect-video w-full bg-muted relative">
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                       <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-muted/30 flex items-center justify-center text-muted-foreground">
                       <ImageIcon className="w-8 h-8 opacity-20" />
                    </div>
                  )}
                  
                  <CardContent className="p-4 flex flex-col flex-1 justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                         <h3 className="font-semibold text-lg leading-tight">{item.name}</h3>
                         <span className="font-bold shrink-0">{formatCurrency(item.basePrice)}</span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <Button variant="secondary" className="w-full gap-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground font-semibold">
                       <Plus className="w-4 h-4" /> Add to Order
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      <ModifierSelector
        item={selectedItem}
        modifierGroups={selectedItem?.modifierGroups || []}
        onCancel={() => setSelectedItem(null)}
        onConfirm={handleAddToCart}
      />
    </div>
  );
}
