/**
 * Delete Organization by Slug
 * ==========================
 *
 * Last reviewed: 2026-02-26
 *
 * PURPOSE
 * -------
 * Deletes a single organization (and all cascade-dependent data) by its slug
 * (the domain prefix, e.g. "discover-circus"). Intended for:
 * - Seed cleanup when an organization has been removed from seed files
 * - One-off environment cleanup (e.g. staging)
 * Not for normal product flows; use superadmin deactivation for soft removal.
 *
 * USAGE
 * -----
 *   DATABASE_URL="<your-database-url>" pnpm delete-org <slug>
 * or:
 *   DATABASE_URL="<your-database-url>" pnpm exec ts-node --compiler-options '{"module":"CommonJS"}' scripts/delete-organization-by-slug.ts <slug>
 *
 * Always set DATABASE_URL explicitly so you target the intended environment
 * (e.g. staging). Do not run against production unless you intend to delete
 * that organization there.
 *
 * SCHEMA DEPENDENCY
 * -----------------
 * This script assumes:
 * - The Prisma model is named "Organization" and has a unique field "slug".
 * - All relations from other models to Organization use onDelete: Cascade.
 * If the schema is renamed, the slug field is removed, or cascades are changed,
 * this script must be updated (and this header re-reviewed).
 *
 * HOW TO VERIFY IT STILL WORKS (for future agents)
 * ------------------------------------------------
 * 1. Run: pnpm prisma generate. Ensure the script compiles (e.g. pnpm exec ts-node
 *    --compiler-options '{"module":"CommonJS"}' scripts/delete-organization-by-slug.ts).
 * 2. In prisma/schema.prisma, confirm: (a) model Organization exists,
 *    (b) it has a unique slug field, (c) child models still reference Organization
 *    with onDelete: Cascade.
 * 3. Test against a local or staging DB with a throwaway org (create one, then
 *    delete it by slug) before using on real data.
 *
 * SAFETY
 * ------
 * - Destructive: the organization and all related rows are permanently deleted.
 * - Always pass DATABASE_URL explicitly for staging; avoid accidentally using
 *   production. Consider adding a guard (e.g. require a flag for production).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = process.argv[2];
  const forceFlag = process.argv.includes("--yes-delete-production-data");
  if (!slug || slug.startsWith("-")) {
    console.error("Usage: delete-organization-by-slug.ts <slug>");
    console.error("Example: pnpm delete-org discover-circus");
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  const dbUrl = process.env.DATABASE_URL || "";
  const looksLikeProduction =
    nodeEnv === "production" || dbUrl.includes("prod") || dbUrl.includes("uplifter.app");

  if (looksLikeProduction && !forceFlag) {
    console.error(
      "SAFETY: This looks like a production database. " +
        "Pass --yes-delete-production-data to confirm."
    );
    process.exit(1);
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    console.error(`Organization not found with slug: ${slug}`);
    process.exit(1);
  }

  if (looksLikeProduction) {
    console.warn(
      `WARNING: Deleting PRODUCTION organization "${org.name}" (${org.slug}, id: ${org.id}) and ALL related data.`
    );
  }

  await prisma.organization.delete({
    where: { slug },
  });

  console.log(`Deleted organization: ${org.name} (${org.slug}, id: ${org.id})`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
