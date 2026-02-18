import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: 'PIN',
            credentials: {
                pinCode: { label: 'PIN Code', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.pinCode || typeof credentials.pinCode !== 'string') {
                    return null;
                }

                // Find all active users and check PIN against each
                const users = await prisma.user.findMany({
                    where: { isActive: true },
                });

                for (const user of users) {
                    const isValid = await bcrypt.compare(
                        credentials.pinCode,
                        user.pinCode
                    );
                    if (isValid) {
                        return {
                            id: user.id,
                            name: user.name,
                            role: user.role,
                        };
                    }
                }

                return null;
            },
        }),
    ],
    session: { strategy: 'jwt' },
});
