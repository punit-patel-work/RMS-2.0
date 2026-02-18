import { getAllUsers } from '@/server/queries/user.queries';
import { UserManager } from '@/components/admin/user-manager';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const users = await getAllUsers();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage staff accounts, roles, and access
        </p>
      </div>
      <UserManager users={JSON.parse(JSON.stringify(users))} />
    </div>
  );
}
