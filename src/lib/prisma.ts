import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton pattern — prevents exhausting DB
// connections from hot-reload creating a new PrismaClient on every save.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
