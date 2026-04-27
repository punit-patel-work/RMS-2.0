import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

const MANAGER_ROLES = ['OWNER', 'SUPERVISOR'] as const;
type ManagerRole = (typeof MANAGER_ROLES)[number];

function isManagerRole(role: unknown): role is ManagerRole {
    return (
        typeof role === 'string' &&
        (MANAGER_ROLES as readonly string[]).includes(role)
    );
}

/**
 * Server-side gate for every route under /admin/*.
 * Previously these pages were only protected by middleware auth (any logged-in
 * user could navigate to /admin/settings and mutate them). This layout
 * enforces role-based access at the server level so role escalation via direct
 * URL navigation is no longer possible.
 */
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }
    if (!isManagerRole(session.user.role)) {
        redirect('/pos');
    }

    return <>{children}</>;
}
