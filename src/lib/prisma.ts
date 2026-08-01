import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "../config/env";

/**
 * Shared Prisma client. Prisma 7 has no bundled query engine, so it needs a
 * driver adapter — PrismaPg wraps the `pg` driver.
 *
 * The instance is cached on globalThis so hot reloads in development reuse one
 * client instead of opening a new connection pool on every restart.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
