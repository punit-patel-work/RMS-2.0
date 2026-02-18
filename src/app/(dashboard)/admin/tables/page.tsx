import { getAllTables } from '@/server/queries/table.queries';
import { TableManager } from '@/components/admin/table-manager';

export const dynamic = 'force-dynamic';

export default async function TablesPage() {
  const tables = await getAllTables();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Table Management</h1>
        <p className="text-sm text-muted-foreground">
          Add and manage restaurant tables
        </p>
      </div>
      <TableManager tables={JSON.parse(JSON.stringify(tables))} />
    </div>
  );
}
