import { getAllPromotions } from '@/server/queries/promotion.queries';
import { getAllMenuItems, getAllCategories } from '@/server/queries/menu.queries';
import { PromotionManager } from '@/components/admin/promotion-manager';

export const dynamic = 'force-dynamic';

export default async function PromotionsPage() {
  const [promotions, menuItems, categories] = await Promise.all([
    getAllPromotions(),
    getAllMenuItems(),
    getAllCategories(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
        <p className="text-sm text-muted-foreground">
          Non-destructive promotions — base prices are never overwritten
        </p>
      </div>
      <PromotionManager
        promotions={JSON.parse(JSON.stringify(promotions))}
        menuItems={JSON.parse(JSON.stringify(menuItems))}
        categories={JSON.parse(JSON.stringify(categories))}
      />
    </div>
  );
}
