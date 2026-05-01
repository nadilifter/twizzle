import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSystemRulesForOrganization } from "@/lib/notification-service";
import { logger } from "@/lib/logger";

// tenant-isolation-ok: Superadmin-only backfill; iterates all organizations

/**
 * POST /api/superadmin/backfill-payout-notification-rules
 *
 * One-time backfill that ensures all existing organizations have the new
 * PAYOUT_PAID, PAYOUT_FAILED, PAYOUT_SCHEDULED, and NEGATIVE_BALANCE_WARNING
 * system notification rules. Safe to re-run — createSystemRulesForOrganization
 * skips rules that already exist.
 */
export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizations = await db.organization.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  let totalCreated = 0;
  let totalExisting = 0;
  const errors: Array<{ organizationId: string; error: string }> = [];

  for (const org of organizations) {
    try {
      const result = await createSystemRulesForOrganization(org.id);
      totalCreated += result.created;
      totalExisting += result.existing;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("backfill-payout-notification-rules: failed for org", {
        organizationId: org.id,
        error: message,
      });
      errors.push({ organizationId: org.id, error: message });
    }
  }

  return NextResponse.json({
    organizationsProcessed: organizations.length,
    rulesCreated: totalCreated,
    rulesAlreadyExisted: totalExisting,
    errors,
  });
}
