/**
 * Verify EventType enum values and event data integrity.
 *
 * Run before and after deploying the CAMP→CLINIC / COMPETITION→TRYOUT migration
 * to confirm the database state is correct.
 *
 * Usage:
 *   npx tsx scripts/verify-event-types.ts
 *
 * Expected output BEFORE migration:
 *   Enum values: CLASS, CAMP, PARTY, COMPETITION, MEETING, OTHER
 *
 * Expected output AFTER migration:
 *   Enum values: CLASS, CLINIC, PARTY, TRYOUT, MEETING, OTHER
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEPRECATED_VALUES = ["CAMP", "COMPETITION"];
const EXPECTED_VALUES = ["CLASS", "CLINIC", "PARTY", "TRYOUT", "MEETING", "OTHER"];

async function main() {
  console.log("=== EventType Verification ===\n");

  const enumValues: Array<{ enumlabel: string }> = await db.$queryRaw`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'EventType'
    ORDER BY enumsortorder
  `;

  const labels = enumValues.map((r) => r.enumlabel);
  console.log(`Enum values: ${labels.join(", ")}`);

  const hasDeprecated = labels.some((l) => DEPRECATED_VALUES.includes(l));
  const hasExpected = EXPECTED_VALUES.every((v) => labels.includes(v));

  if (hasDeprecated) {
    console.log("⚠  Old values (CAMP, COMPETITION) still present — migration has NOT run yet");
  } else if (hasExpected) {
    console.log("✓  Enum values are up to date");
  } else {
    console.log("✗  Unexpected enum state — manual investigation required");
  }

  const counts: Array<{ type: string; count: bigint }> = await db.$queryRaw`
    SELECT type::text, COUNT(*) as count
    FROM "Event"
    GROUP BY type
    ORDER BY count DESC
  `;

  console.log("\nEvents by type:");
  if (counts.length === 0) {
    console.log("  (no events)");
  } else {
    for (const row of counts) {
      const flag = DEPRECATED_VALUES.includes(row.type) ? " ← needs migration" : "";
      console.log(`  ${row.type}: ${row.count}${flag}`);
    }
  }

  const total = counts.reduce((sum, r) => sum + Number(r.count), 0);
  console.log(`  Total: ${total}`);

  const orphaned = counts.filter((r) => DEPRECATED_VALUES.includes(r.type));
  if (orphaned.length > 0) {
    const orphanedCount = orphaned.reduce((sum, r) => sum + Number(r.count), 0);
    console.log(`\n✗  ${orphanedCount} event(s) still have deprecated types.`);
    console.log("   Run 'prisma migrate deploy' to apply the rename migration.");
    process.exit(1);
  }

  console.log("\n✓  All events have valid types. Deployment is safe.");
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
