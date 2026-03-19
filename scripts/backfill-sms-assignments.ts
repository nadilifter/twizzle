/**
 * Backfill SmsNumberAssignment records from existing outbound SMS messages.
 *
 * For each distinct (phone, organizationId) pair found in outbound messages,
 * assigns a pool number so that future inbound replies route deterministically.
 *
 * Usage:
 *   SMS_PHONE_POOL=+1...,+2... npx tsx scripts/backfill-sms-assignments.ts
 *
 * Safe to run multiple times — skips pairs that already have assignments.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function getPhonePool(): string[] {
  const poolEnv = process.env.SMS_PHONE_POOL;
  if (poolEnv) {
    const pool = poolEnv.split(",").map((n) => n.trim()).filter(Boolean);
    if (pool.length > 0) return pool;
  }
  const fallback = process.env.TWILIO_PHONE_NUMBER;
  return fallback ? [fallback] : [];
}

async function main() {
  const pool = getPhonePool();
  if (pool.length === 0) {
    console.error("No phone pool configured. Set SMS_PHONE_POOL or TWILIO_PHONE_NUMBER.");
    process.exit(1);
  }

  console.log(`Phone pool: ${pool.join(", ")} (${pool.length} numbers)`);

  // Find all distinct (to, organizationId) pairs from outbound messages
  const pairs: Array<{ to: string; organizationId: string }> = await db.$queryRaw`
    SELECT DISTINCT "to", "organizationId"
    FROM "SmsMessage"
    WHERE direction = 'OUTBOUND'
    ORDER BY "organizationId", "to"
  `;

  console.log(`Found ${pairs.length} distinct (phone, org) pairs to process.`);

  let created = 0;
  let skipped = 0;
  let exhausted = 0;

  // Track per-phone assignments to mirror the pool allocation algorithm
  const phoneAssignments = new Map<string, Map<string, string>>();
  // phone -> Map<twilioNumber, organizationId>

  for (const { to: phone, organizationId } of pairs) {
    // Check if already assigned
    const existing = await db.smsNumberAssignment.findUnique({
      where: { phone_organizationId: { phone, organizationId } },
    });

    if (existing) {
      skipped++;
      // Track this existing assignment
      if (!phoneAssignments.has(phone)) phoneAssignments.set(phone, new Map());
      phoneAssignments.get(phone)!.set(existing.twilioNumber, organizationId);
      continue;
    }

    // Find which pool numbers are already used for this phone
    if (!phoneAssignments.has(phone)) {
      const existingForPhone = await db.smsNumberAssignment.findMany({
        where: { phone },
        select: { twilioNumber: true, organizationId: true },
      });
      const m = new Map<string, string>();
      for (const a of existingForPhone) m.set(a.twilioNumber, a.organizationId);
      phoneAssignments.set(phone, m);
    }

    const usedNumbers = phoneAssignments.get(phone)!;
    const chosen = pool.find((n) => !usedNumbers.has(n));

    if (!chosen) {
      exhausted++;
      console.warn(`  WARN: Pool exhausted for phone ${phone} (org ${organizationId})`);
      continue;
    }

    try {
      await db.smsNumberAssignment.create({
        data: { phone, twilioNumber: chosen, organizationId },
      });
      usedNumbers.set(chosen, organizationId);
      created++;
    } catch (err: any) {
      if (err.code === "P2002") {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  console.log(`\nDone.`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already existed): ${skipped}`);
  if (exhausted > 0) {
    console.log(`  Pool exhausted (needs more numbers): ${exhausted}`);
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
