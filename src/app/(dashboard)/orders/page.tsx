import { OrderHistory } from '@/components/orders/order-history';

export const dynamic = 'force-dynamic';

export default function OrdersPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order History</h1>
        <p className="text-sm text-muted-foreground">
          View, search, and manage past orders
        </p>
      </div>
      <OrderHistory />
    </div>
  );
}
