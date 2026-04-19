'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing';

interface ReceiptItem {
  quantity: number;
  menuItem: { name: string; basePrice: number };
  frozenPrice: number;
  modifiers?: { name: string; price: number }[];
  notes?: string | null;
  status: string;
  refunded?: boolean;
}

interface ReceiptPayment {
  method: string;
  amount: number;
}

interface ReceiptOrder {
  orderNumber: number;
  orderType?: string;
  status: string;
  createdAt: string | Date;
  table?: { name: string } | null;
  customerName?: string | null;
  createdBy?: { name: string } | null;
  items: ReceiptItem[];
  payments?: ReceiptPayment[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  refundAmount?: number | null;
}

interface ReceiptPreviewProps {
  order: ReceiptOrder | null;
  onClose: () => void;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
}

export function ReceiptPreview({
  order,
  onClose,
  restaurantName = 'Restaurant',
  restaurantAddress = '',
  restaurantPhone = '',
}: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const activeItems = order.items.filter((i) => i.status !== 'VOIDED');

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${order.orderNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              width: 280px;
              margin: 0 auto;
              padding: 10px;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #999; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .items { margin: 4px 0; }
            .item-row { display: flex; justify-content: space-between; padding: 2px 0; }
            .mod { font-size: 10px; color: #666; padding-left: 16px; }
            .note { font-size: 10px; color: #999; padding-left: 16px; font-style: italic; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; padding: 4px 0; }
            .footer { text-align: center; margin-top: 12px; font-size: 11px; color: #666; }
            @media print {
              body { width: 100%; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-muted-foreground" />
            Receipt Preview
          </DialogTitle>
        </DialogHeader>

        {/* Receipt content — this is what gets printed */}
        <div
          ref={receiptRef}
          className="bg-white text-black rounded-lg border p-5 font-mono text-xs space-y-2 max-h-[60vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center space-y-0.5">
            <p className="text-sm font-bold">{restaurantName}</p>
            {restaurantAddress && <p>{restaurantAddress}</p>}
            {restaurantPhone && <p>{restaurantPhone}</p>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Order info */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="font-bold">Order #{order.orderNumber}</span>
              <span>{order.status}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{dateStr} {timeStr}</span>
              <span>{order.createdBy?.name}</span>
            </div>
            {order.table && (
              <p className="text-[10px]">Table: {order.table.name}</p>
            )}
            {order.customerName && (
              <p className="text-[10px]">Customer: {order.customerName}</p>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Items */}
          <div className="space-y-1">
            {activeItems.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between">
                  <span>
                    {item.quantity}× {item.menuItem.name}
                    {item.refunded && ' [REFUNDED]'}
                  </span>
                  <span>{formatCurrency(item.frozenPrice * item.quantity)}</span>
                </div>
                {item.modifiers?.map((mod, j) => (
                  <p key={j} className="pl-4 text-[10px] text-gray-500">
                    + {mod.name} ({formatCurrency(mod.price)})
                  </p>
                ))}
                {item.notes && (
                  <p className="pl-4 text-[10px] text-gray-400 italic">
                    Note: {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Totals */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="border-t border-gray-300 my-1" />
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            {order.refundAmount && order.refundAmount > 0 && (
              <div className="flex justify-between text-amber-700 text-[11px]">
                <span>Refunded</span>
                <span>-{formatCurrency(order.refundAmount)}</span>
              </div>
            )}
          </div>

          {/* Payments */}
          {order.payments && order.payments.length > 0 && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className="space-y-0.5">
                <p className="font-bold text-[10px]">PAYMENTS</p>
                {order.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span>{p.method}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-500 space-y-0.5">
            <p>Thank you for dining with us!</p>
            <p>Please come again</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
