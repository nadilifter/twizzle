import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
export const db = globalThis.prismaClient || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = db;
}

export default db;
