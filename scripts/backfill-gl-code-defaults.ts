/**
 * Backfill default GL codes for all existing organizations.
 *
 * For each organization, creates the standard set of default GL codes
 * (Program Revenue, Event Revenue, etc.) if they don't already exist.
 * Uses the same logic as the org-signup flow so existing and new orgs
 * have identical defaults.
 *
 * Usage:
 *   npx tsx scripts/backfill-gl-code-defaults.ts
 *
 * Options:
 *   --dry-run    Preview what would be created without making changes
 *
 * Safe to run multiple times — skips orgs that already have defaults.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

const DEFAULT_GL_CODES = [
  {
    code: "4100",
    description: "Program Revenue",
    type: "REVENUE" as const,
    defaultForType: "PROGRAM" as const,
  },
  {
    code: "4200",
    description: "Event Revenue",
    type: "REVENUE" as const,
    defaultForType: "EVENT" as const,
  },
  {
    code: "4300",
    description: "Competition Revenue",
    type: "REVENUE" as const,
    defaultForType: "COMPETITION" as const,
  },
  {
    code: "4400",
    description: "Membership Revenue",
    type: "REVENUE" as const,
    defaultForType: "MEMBERSHIP" as const,
  },
  {
    code: "4500",
    description: "Pass Revenue",
    type: "REVENUE" as const,
    defaultForType: "PASS" as const,
  },
  {
    code: "4600",
    description: "Product Revenue",
    type: "REVENUE" as const,
    defaultForType: "PRODUCT" as const,
  },
  {
    code: "2100",
    description: "Sales Tax Collected",
    type: "LIABILITY" as const,
    defaultForType: null,
  },
] as const;

async function main() {
  if (isDryRun) {
    console.log("=== DRY RUN MODE — no changes will be made ===\n");
  }

  const organizations = await db.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${organizations.length} organizations to process.\n`);

  let totalCreated = 0;
  let orgsSkipped = 0;
  let orgsUpdated = 0;

  for (const org of organizations) {
    const existing = await db.gLCode.findMany({
      where: { organizationId: org.id, isDefault: true },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((g) => g.code));

    const toCreate = DEFAULT_GL_CODES.filter((d) => !existingCodes.has(d.code));

    if (toCreate.length === 0) {
      orgsSkipped++;
      continue;
    }

    console.log(`  ${org.name} (${org.id}): creating ${toCreate.length} default GL codes`);
    for (const d of toCreate) {
      console.log(`    + ${d.code} — ${d.description} (${d.type})`);
    }

    if (!isDryRun) {
      await db.gLCode.createMany({
        data: toCreate.map((d) => ({
          code: d.code,
          description: d.description,
          type: d.type,
          defaultForType: d.defaultForType,
          isDefault: true,
          organizationId: org.id,
        })),
      });
    }

    totalCreated += toCreate.length;
    orgsUpdated++;
  }

  console.log(`\nDone.`);
  console.log(`  Organizations processed: ${organizations.length}`);
  console.log(`  Organizations updated: ${orgsUpdated}`);
  console.log(`  Organizations skipped (already had all defaults): ${orgsSkipped}`);
  console.log(`  GL codes ${isDryRun ? "would be " : ""}created: ${totalCreated}`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
