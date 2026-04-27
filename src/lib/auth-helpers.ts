import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';

export type Role = 'OWNER' | 'SUPERVISOR' | 'FLOOR_STAFF' | 'KITCHEN_STAFF';

/**
 * Standard error shape for server actions.
 */
export class AuthError extends Error {
    status: 401 | 403;
    constructor(message: string, status: 401 | 403) {
        super(message);
        this.status = status;
    }
}

/**
 * Ensures the caller has a valid session. Throws AuthError(401) otherwise.
 * Returns a narrowed Session where `user` is guaranteed.
 */
export async function requireSession(): Promise<Session & { user: NonNullable<Session['user']> }> {
    const session = await auth();
    if (!session?.user) {
        throw new AuthError('Unauthorized', 401);
    }
    return session as Session & { user: NonNullable<Session['user']> };
}

/**
 * Ensures the caller has one of the given roles.
 * Throws AuthError(401) if unauthenticated, AuthError(403) if wrong role.
 */
export async function requireRole(
    roles: Role[]
): Promise<Session & { user: NonNullable<Session['user']> & { role: Role } }> {
    const session = await requireSession();
    const role = session.user.role as Role | undefined;
    if (!role || !roles.includes(role)) {
        throw new AuthError('Forbidden: insufficient permissions', 403);
    }
    return session as Session & { user: NonNullable<Session['user']> & { role: Role } };
}

/**
 * Helper for admin-gated actions (OWNER + SUPERVISOR).
 */
export function requireManager() {
    return requireRole(['OWNER', 'SUPERVISOR']);
}

/**
 * Helper for OWNER-only actions (user management, site settings).
 */
export function requireOwner() {
    return requireRole(['OWNER']);
}

/**
 * Wraps an action's error handling so AuthError becomes a typed return value.
 * Usage:
 *   return withAuthGuard(() => requireManager(), async (session) => { ... });
 */
export async function withAuthGuard<T>(
    guard: () => Promise<Session & { user: NonNullable<Session['user']> }>,
    fn: (session: Session & { user: NonNullable<Session['user']> }) => Promise<T>
): Promise<T | { success: false; error: string }> {
    try {
        const session = await guard();
        return await fn(session);
    } catch (err) {
        if (err instanceof AuthError) {
            return { success: false, error: err.message };
        }
        throw err;
    }
}
