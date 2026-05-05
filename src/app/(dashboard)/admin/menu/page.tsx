import { getAllMenuItems, getAllCategories, getAllStations } from '@/server/queries/menu.queries';
import { MenuManager } from '@/components/admin/menu-manager';
import { toPlain } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const [items, categories, stations] = await Promise.all([
    getAllMenuItems(),
    getAllCategories(),
    getAllStations(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Menu Manager</h1>
        <p className="text-sm text-muted-foreground">
          Add, edit, and 86 menu items
        </p>
      </div>
      <MenuManager
        items={toPlain(items)}
        categories={toPlain(categories)}
        stations={toPlain(stations)}
      />
    </div>
  );
}
