import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSuperadminOverview, getSettlementSummary } from "@/lib/settlement-reporting";

/**
 * GET /api/superadmin/settlement
 *
 * Returns platform-wide settlement overview and per-org breakdown
 * for superadmin financial reporting.
 *
 * Query params:
 *   - start: ISO date string (default: first of current month)
 *   - end:   ISO date string (default: now)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    const now = new Date();
    const startDate = searchParams.get("start")
      ? new Date(searchParams.get("start")!)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = searchParams.get("end") ? new Date(searchParams.get("end")!) : now;

    const overview = await getSuperadminOverview(startDate, endDate);

    // Per-org breakdown: only orgs that have transactions in the period
    const orgsWithTransactions = await db.transaction.groupBy({
      by: ["organizationId"],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    const orgIds = orgsWithTransactions.map((o) => o.organizationId);

    const orgSummaries = await Promise.all(
      orgIds.slice(0, 50).map((orgId) => getSettlementSummary(orgId, startDate, endDate))
    );

    // Fetch onboarding status for these orgs
    const platformAccounts = await db.adyenPlatformAccount.findMany({
      where: { organizationId: { in: orgIds } },
      select: { organizationId: true, onboardingStatus: true },
    });
    const statusMap = new Map(platformAccounts.map((a) => [a.organizationId, a.onboardingStatus]));

    const orgBreakdown = orgSummaries
      .map((s) => ({
        ...s,
        onboardingStatus: statusMap.get(s.organizationId) || "not_onboarded",
        period: {
          start: s.period.start.toISOString(),
          end: s.period.end.toISOString(),
        },
      }))
      .sort((a, b) => b.grossPayments - a.grossPayments);

    return NextResponse.json({
      overview,
      orgBreakdown,
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
    });
  } catch (error) {
    console.error("Error fetching superadmin settlement data:", error);
    return NextResponse.json({ error: "Failed to fetch settlement data" }, { status: 500 });
  }
}
