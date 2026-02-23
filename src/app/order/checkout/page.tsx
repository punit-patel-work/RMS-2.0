import { StorefrontCheckoutForm } from '@/components/storefront/storefront-checkout';

export default function CheckoutPage() {
  return (
    <div className="bg-muted/10 min-h-[calc(100vh-3.5rem)] pb-24 h-full">
      <div className="container mx-auto">
         <StorefrontCheckoutForm />
      </div>
    </div>
  );
}
