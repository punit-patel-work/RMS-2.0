'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCustomers, registerCustomer } from '@/server/actions/crm.actions';
import { CustomerDetailsDialog } from '@/components/admin/customer-details-dialog';
import { Search, UserPlus, Loader2, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function AddCustomerDialog({ isOpen, onClose, onAdded }: { isOpen: boolean, onClose: () => void, onAdded: () => void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSave = async () => {
    if (!phone || phone.length < 5) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setIsPending(true);
    const result = await registerCustomer(phone.trim(), name.trim() || undefined);
    setIsPending(false);
    
    if (result.success) {
      toast.success('Customer registered successfully');
      setPhone('');
      setName('');
      onAdded();
      onClose();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-muted-foreground" />
            Register Customer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input 
              id="phone" 
              placeholder="(555) 123-4567" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input 
              id="name" 
              placeholder="John Doe" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: customers, isLoading, mutate } = useSWR(
    ['customers', debouncedSearch],
    () => getCustomers(debouncedSearch.trim() || undefined)
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers & Loyalty</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer database, view history, and adjust loyalty points.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Register Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              Customer Database
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name or phone..."
                className="pl-8 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Points Balance</TableHead>
                  <TableHead className="text-right">Lifetime Orders</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead className="text-right">Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : customers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers?.map((customer) => (
                    <TableRow 
                      key={customer.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      <TableCell className="font-medium">
                        {customer.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {customer.phone}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-center bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full text-xs">
                          {customer.pointsBalance} pts
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{customer.orderCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(customer.lifetimeValue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {customer.lastOrderDate 
                          ? new Date(customer.lastOrderDate).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CustomerDetailsDialog 
        customerId={selectedCustomerId} 
        onClose={() => setSelectedCustomerId(null)} 
        onUpdated={mutate}
      />
      
      <AddCustomerDialog 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        onAdded={mutate}
      />
    </div>
  );
}
