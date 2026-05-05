import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient() {
    // P-M10: explicit pool sizing. The default pg-Pool of 10 connections is
    // fine for dev but on a serverless or busy multi-tablet deployment a
    // dinner-rush burst (KDS poll + serve poll + multiple POS firings) will
    // exhaust the pool and produce timeout errors that look like Prisma bugs.
    // We expose POOL_MAX (server) and POOL_IDLE (ms) via env so each
    // environment can tune; defaults err on the conservative side for Neon
    // (which has its own pooler in front).
    const poolMax = parseInt(process.env.DATABASE_POOL_MAX ?? '20', 10);
    const idleTimeoutMillis = parseInt(process.env.DATABASE_POOL_IDLE_MS ?? '30000', 10);

    const adapter = new PrismaPg(
        {
            connectionString: process.env.DATABASE_URL!,
            max: poolMax,
            idleTimeoutMillis,
        }
    );
    return new PrismaClient({ adapter });
}

export const prisma =
    globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
