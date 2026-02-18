import { getAllCategories } from '@/server/queries/menu.queries';
import { getActivePromotions } from '@/server/queries/promotion.queries';
import { QuickSaleBuilder } from '@/components/pos/quick-sale-builder';

export const dynamic = 'force-dynamic';

export default async function QuickSalePage() {
  const [allCategories, promotions] = await Promise.all([
    getAllCategories(),
    getActivePromotions(),
  ]);

  // Filter for Quick Sale items only
  const allowedCategories = ['Ice Cream', 'Frozen Yogurt', 'Beverages'];
  const categories = allCategories.filter(c => allowedCategories.includes(c.name));

  return (
    <QuickSaleBuilder
      categories={JSON.parse(JSON.stringify(categories))}
      promotions={JSON.parse(JSON.stringify(promotions))}
    />
  );
}
