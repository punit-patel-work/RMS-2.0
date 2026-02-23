import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: 'Employee Login',
            credentials: {
                employeeId: { label: 'Employee ID', type: 'text' },
                pinCode: { label: 'PIN Code', type: 'password' },
            },
            async authorize(credentials) {
                if (
                    !credentials?.employeeId ||
                    typeof credentials.employeeId !== 'string' ||
                    !credentials?.pinCode ||
                    typeof credentials.pinCode !== 'string'
                ) {
                    return null;
                }

                // Find the specific active user by Employee ID
                const user = await prisma.user.findUnique({
                    where: { employeeId: credentials.employeeId },
                });

                if (!user || (!user.isActive && user.role !== 'OWNER')) {
                    // Only active users or the system owner can log in
                    return null;
                }

                // Verify their PIN
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

                return null;
            },
        }),
    ],
    session: { strategy: 'jwt' },
});
