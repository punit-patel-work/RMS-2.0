import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
    // Run middleware on all routes except static files, _next, and api
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
    ],
};
