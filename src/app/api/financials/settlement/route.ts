import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getSettlementSummary, getPayoutHistory } from "@/lib/settlement-reporting";

/**
 * GET /api/financials/settlement
 *
 * Returns settlement summary (gross, refunds, chargebacks, net) and payout history
 * for the authenticated user's organization.
 *
 * Query params:
 *   - start: ISO date string (default: first of current month)
 *   - end:   ISO date string (default: now)
 *   - payoutLimit: number of payout records to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;

    const now = new Date();
    const startDate = searchParams.get("start")
      ? new Date(searchParams.get("start")!)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = searchParams.get("end") ? new Date(searchParams.get("end")!) : now;
    const payoutLimit = parseInt(searchParams.get("payoutLimit") || "20", 10);

    const [summary, payouts] = await Promise.all([
      getSettlementSummary(organizationId, startDate, endDate),
      getPayoutHistory(organizationId, payoutLimit),
    ]);

    return NextResponse.json({ summary, payouts });
  } catch (error) {
    console.error("Error fetching settlement data:", error);
    return NextResponse.json({ error: "Failed to fetch settlement data" }, { status: 500 });
  }
}
