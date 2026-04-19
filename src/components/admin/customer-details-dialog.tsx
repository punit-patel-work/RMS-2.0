'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { updateCustomerPoints, getCustomerDetails } from '@/server/actions/crm.actions';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/pricing';
import { Clock, History, Award, Loader2 } from 'lucide-react';
import useSWR from 'swr';

interface CustomerDetailsDialogProps {
  customerId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function CustomerDetailsDialog({ customerId, onClose, onUpdated }: CustomerDetailsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [pointsDelta, setPointsDelta] = useState('');
  
  // Fetch detailed history only when dialog opens
  const { data: details, isLoading, mutate } = useSWR(
    customerId ? `customer-details-${customerId}` : null,
    async () => {
      if (!customerId) return null;
      return getCustomerDetails(customerId);
    }
  );

  const handleAdjustPoints = () => {
    const delta = parseInt(pointsDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast.error('Enter a valid points amount to add or deduct.');
      return;
    }

    if (!customerId) return;

    startTransition(async () => {
      const result = await updateCustomerPoints(customerId, delta);
      if (result.success) {
        toast.success(`Points updated. New balance: ${result.pointsBalance}`);
        setPointsDelta('');
        mutate(); // refresh local SWR state
        onUpdated(); // refresh parent table
      } else {
        toast.error(result.error);
      }
    });
  };

  if (!customerId) return null;

  return (
    <Dialog open={!!customerId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>

        {isLoading || !details ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 overflow-hidden">
            
            {/* Header Info */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">{details.name || 'Unknown Name'}</h3>
                <p className="text-muted-foreground font-mono">{details.phone}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enrolled: {new Date(details.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col items-center min-w-[120px]">
                <Award className="w-6 h-6 text-primary mb-1" />
                <span className="text-xs text-primary font-semibold uppercase">Points</span>
                <span className="text-2xl font-bold text-primary">{details.pointsBalance}</span>
              </div>
            </div>

            <Separator />

            {/* Manual Points Adjustment */}
            <div className="bg-muted/50 p-4 rounded-lg flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="pointsDelta">Adjust Points Balance</Label>
                <div className="flex gap-2">
                  <Input 
                    id="pointsDelta" 
                    type="number" 
                    placeholder="e.g. 50, or -20" 
                    value={pointsDelta}
                    onChange={(e) => setPointsDelta(e.target.value)}
                  />
                  <Button onClick={handleAdjustPoints} disabled={isPending || !pointsDelta}>
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              </div>
              <div className="flex-1 text-xs text-muted-foreground pb-2">
                Use positive numbers to add reward points manually. 
                Use negative numbers to deduct points.
              </div>
            </div>

            {/* Order History */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                <History className="w-4 h-4" /> Order History ({details.orders.length})
              </h4>
              
              <ScrollArea className="flex-1 border rounded-md">
                {details.orders.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No orders found for this customer.
                  </div>
                ) : (
                  <div className="divide-y">
                    {details.orders.map((order) => (
                      <div key={order.id} className="p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Order #{order.orderNumber}</span>
                            <Badge variant="outline" className="text-[10px]">{order.orderType}</Badge>
                            <Badge variant={order.status === 'PAID' ? 'default' : 'secondary'} className="text-[10px]">
                              {order.status}
                            </Badge>
                          </div>
                          <span className="font-semibold">{formatCurrency(order.total)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.createdAt).toLocaleString()}
                          </span>
                          <span>
                            {order.items.length} items
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-1">
                          {order.items.map(i => `${i.quantity}x ${i.menuItem.name}`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
