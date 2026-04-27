import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';
import { hit, reset } from '@/lib/rate-limit';

// S-H1: cap login attempts per employee ID so PIN guessing against bcrypt is
// economically uninteresting. 10 attempts per 5-minute window leaves plenty of
// room for a fat-fingered staff member but breaks brute force.
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

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

                // Rate limit BEFORE bcrypt — bcrypt is expensive on purpose,
                // and an attacker shouldn't be allowed to amortize CPU by
                // burning our cycles. Key on a normalized employeeId so
                // case/whitespace variants share the same bucket.
                const rlKey = `login:${credentials.employeeId.trim().toLowerCase()}`;
                const rl = hit(rlKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
                if (!rl.ok) {
                    // Returning null surfaces as "Invalid credentials" to the
                    // client, which is the correct UX — we don't want to leak
                    // "this employee ID is being attacked" to the attacker.
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
                    // Clear the rate-limit bucket so a successful staff login
                    // doesn't lock them out after several earlier fat-fingers.
                    reset(rlKey);
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
