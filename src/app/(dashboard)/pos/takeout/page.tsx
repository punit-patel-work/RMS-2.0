import { getMenuByCategory } from '@/server/queries/menu.queries';
import { getActivePromotions } from '@/server/queries/promotion.queries';
import { TakeoutBuilder } from '@/components/pos/takeout-builder';
import { toPlain } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export default async function TakeoutPage() {
  const [categories, promotions] = await Promise.all([
    getMenuByCategory(),
    getActivePromotions(),
  ]);

  return (
    <TakeoutBuilder
      categories={toPlain(categories)}
      promotions={toPlain(promotions)}
    />
  );
}
