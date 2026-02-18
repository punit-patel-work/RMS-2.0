import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible auth config (no Prisma imports).
 * Used by middleware for route protection.
 */
export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/pos') ||
                nextUrl.pathname.startsWith('/kds') ||
                nextUrl.pathname.startsWith('/admin');
            const isOnLogin = nextUrl.pathname === '/login';

            if (isOnDashboard) {
                if (!isLoggedIn) return false; // Redirect to login
                return true;
            }

            if (isOnLogin && isLoggedIn) {
                return Response.redirect(new URL('/pos', nextUrl));
            }

            return true;
        },
        jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.name = user.name;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role;
                session.user.name = token.name;
            }
            return session;
        },
    },
    providers: [], // Providers added in auth.ts (not edge-safe)
} satisfies NextAuthConfig;
