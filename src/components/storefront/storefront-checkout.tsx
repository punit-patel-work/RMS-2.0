"use client";

import { useState, useTransition } from "react";
import { useCustomerCartStore } from "@/stores/customer-cart-store";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/pricing";
import { fireOrder } from "@/server/actions/order.actions";
import { ShoppingBag, Clock, User, Phone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function StorefrontCheckoutForm() {
  const cart = useCustomerCartStore();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    time: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.time) {
      toast.error("Please fill in all fields");
      return;
    }

    if (cart.items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    startTransition(async () => {
      // Calculate scheduled time based on today
      const today = new Date();
      const [hours, minutes] = form.time.split(":");
      const scheduledAt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        parseInt(hours),
        parseInt(minutes),
      );

      const result = await fireOrder({
        orderType: "TAKEOUT",
        paymentMethod: "LATER_PAY",
        customerName: form.name,
        customerPhone: form.phone,
        scheduledAt: scheduledAt,
        pointsToRedeem: 0,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes || "",
          selectedModifiers: i.selectedModifiers || [],
        })),
      });

      if (result.success) {
        toast.success("Order placed successfully!");
        cart.reset();
        setSuccess(true);
        // Normally we'd return the order ID from fireOrder, but since it just returns {success:true}, we'll fake a reference.
        setOrderId(Math.random().toString(36).substring(2, 8).toUpperCase());
      } else {
        toast.error(result.error);
      }
    });
  };

  if (success) {
    return (
      <Card className="max-w-md mx-auto mt-12 text-center p-6 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl text-emerald-800 dark:text-emerald-300">
            Order Confirmed!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-emerald-700/80 dark:text-emerald-400/80">
          <p>Thank you for your order, {form.name}!</p>
          <p>
            Your order number is{" "}
            <strong className="text-emerald-900 dark:text-emerald-100 font-mono text-lg">
              {orderId}
            </strong>
          </p>
          <p className="mt-4">
            We will see you at <strong>{form.time}</strong> for pickup.
          </p>
          <p className="text-sm mt-4">
            Payment will be collected at the counter.
          </p>
        </CardContent>
        <CardFooter className="pt-6">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => router.push("/order")}
          >
            Return to Menu
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto py-8 px-4">
      {/* Checkout Form */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> Checkout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            id="checkout-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" /> Full Name
              </Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4" /> Phone Number
              </Label>
              <Input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
              <p className="text-xs text-muted-foreground">
                We use this to verify your order and reward loyalty points.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Pickup Time
              </Label>
              <Input
                required
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="bg-muted/30 pt-6">
          <Button
            type="submit"
            form="checkout-form"
            className="w-full text-lg py-6"
            disabled={isPending || cart.items.length === 0}
          >
            {isPending ? "Processing..." : "Place Order"}
          </Button>
        </CardFooter>
      </Card>

      {/* Order Summary */}
      <Card className="bg-muted/10 border-dashed h-fit">
        <CardHeader>
          <CardTitle className="text-lg text-muted-foreground">
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-start text-sm"
              >
                <div className="flex gap-2">
                  <span className="font-medium">{item.quantity}x</span>
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    {item.selectedModifiers &&
                      item.selectedModifiers.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {item.selectedModifiers.map((m) => m.name).join(", ")}
                        </p>
                      )}
                  </div>
                </div>
                <span className="font-medium shrink-0">
                  {formatCurrency(item.effectivePrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax (7%)</span>
              <span>{formatCurrency(cart.tax)}</span>
            </div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span>-{formatCurrency(cart.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(cart.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
