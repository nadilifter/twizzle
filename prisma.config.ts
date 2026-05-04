import "dotenv/config";
import { defineConfig } from "prisma/config";
import path from "node:path";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    // Comprehensive dev seed — used by `prisma db seed` and `prisma migrate reset`.
    // The `db:seed` npm script bypasses this and runs the bootstrap (seed.ts) directly.
    // See docs/SEEDING.md for the full split.
    seed: "tsx prisma/seed-dev.ts",
  },
});
