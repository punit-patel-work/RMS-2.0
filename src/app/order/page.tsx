import { getMenuByCategory } from '@/server/queries/menu.queries';
import { StorefrontMenu } from '@/components/storefront/storefront-menu';

export const dynamic = 'force-dynamic';

export default async function OrderPage() {
  const categories = await getMenuByCategory();

  return (
    <div className="bg-muted/10 min-h-[calc(100vh-3.5rem)] pb-24">
      <StorefrontMenu categories={JSON.parse(JSON.stringify(categories))} />
    </div>
  );
}
