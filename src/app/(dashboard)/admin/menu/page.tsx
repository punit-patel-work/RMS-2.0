import { getAllMenuItems, getAllCategories } from '@/server/queries/menu.queries';
import { MenuManager } from '@/components/admin/menu-manager';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const [items, categories] = await Promise.all([
    getAllMenuItems(),
    getAllCategories(),
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
        items={JSON.parse(JSON.stringify(items))}
        categories={JSON.parse(JSON.stringify(categories))}
      />
    </div>
  );
}
