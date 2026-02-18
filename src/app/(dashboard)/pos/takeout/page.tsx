import { getMenuByCategory } from '@/server/queries/menu.queries';
import { getActivePromotions } from '@/server/queries/promotion.queries';
import { TakeoutBuilder } from '@/components/pos/takeout-builder';

export const dynamic = 'force-dynamic';

export default async function TakeoutPage() {
  const [categories, promotions] = await Promise.all([
    getMenuByCategory(),
    getActivePromotions(),
  ]);

  return (
    <TakeoutBuilder
      categories={JSON.parse(JSON.stringify(categories))}
      promotions={JSON.parse(JSON.stringify(promotions))}
    />
  );
}
