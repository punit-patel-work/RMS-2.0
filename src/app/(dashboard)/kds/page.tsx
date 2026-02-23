'use client';

import { useKdsOrders } from '@/hooks/use-kds-orders';
import { KdsCard } from '@/components/kds/kds-card';
import { ChefHat, Loader2, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllStations } from '@/server/queries/menu.queries';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function KDSPage() {
  const { orders, isLoading, isError } = useKdsOrders();
  const [stations, setStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('all');

  useEffect(() => {
    getAllStations().then(setStations);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">Failed to load orders</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <ChefHat className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-xl text-muted-foreground">No active orders</p>
        <p className="text-sm text-muted-foreground/60">
          Orders will appear here when fired from POS
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ChefHat className="w-6 h-6" />
            Kitchen Display
          </h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} active order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {stations.length > 0 && (
          <Tabs value={selectedStation} onValueChange={setSelectedStation} className="w-full sm:w-auto overflow-x-auto">
            <TabsList>
              <TabsTrigger value="all">All Stations</TabsTrigger>
              {stations.map(s => (
                <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="flex items-center gap-4 text-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">&lt; 10 min</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">10-20 min</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">&gt; 20 min</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order: any) => {
          // Filter out items that don't belong to the selected station
          const filteredItems = selectedStation === 'all' 
            ? order.items 
            : order.items.filter((item: any) => item.menuItem?.category?.stationId === selectedStation);
            
          if (filteredItems.length === 0) return null; // Hide order if no items for this station
          
          return <KdsCard key={order.id} order={{ ...order, items: filteredItems }} />;
        })}
      </div>
    </div>
  );
}
