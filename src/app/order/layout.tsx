import { CustomerCartDrawer } from '@/components/storefront/customer-cart-drawer';

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex">
            <a className="flex items-center space-x-2" href="/order">
              <span className="font-bold text-lg">
                🍽️ Our Menu
              </span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <CustomerCartDrawer />
          </div>
        </div>
      </header>
      <main className="flex-1 bg-muted/20">
        {children}
      </main>
    </div>
  );
}
