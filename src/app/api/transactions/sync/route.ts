import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchPlatformPaymentTransfers } from "@/lib/adyen-platform";
import { backfillMissingTransactions, recomputePayoutFinancials } from "@/lib/payout-utils";
import { logger } from "@/lib/logger";

const MAX_DAYS = 365;
const DEFAULT_DAYS = 90;

// POST /api/transactions/sync
// Fetches platformPayment transfers from Adyen for the org's balance account
// and backfills any that are missing from the local Transaction table.
// Pass ?days=N (max 365) to control the lookback window (default 90).
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { permissions, organizationId } = session.user;
    if (!permissions.includes("*") && !permissions.includes("financials.admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") || String(DEFAULT_DAYS)), MAX_DAYS);

    // AdyenPlatformAccount is intentionally excluded from TENANT_MODELS in lib/db.ts
    // (managed by superadmins/system jobs), so getScopedDb does NOT auto-scope it.
    // Use raw db with an explicit organizationId filter — otherwise findFirst returns
    // whichever ACTIVE record happens to be first in the table (any org's), causing
    // the sync to query the wrong balance account.
    const platformAccount = await db.adyenPlatformAccount.findUnique({
      where: { organizationId },
      select: { balanceAccountId: true, accountStatus: true },
    });

    if (platformAccount && platformAccount.accountStatus !== "ACTIVE") {
      return NextResponse.json(
        { error: "Adyen account is not active for this organization" },
        { status: 404 }
      );
    }

    if (!platformAccount?.balanceAccountId) {
      return NextResponse.json(
        { error: "No active Adyen balance account found for this organization" },
        { status: 404 }
      );
    }

    const until = new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

    logger.info("[transactions/sync] Fetching platformPayment transfers from Adyen", {
      organizationId,
      balanceAccountId: platformAccount.balanceAccountId,
      since: since.toISOString(),
      until: until.toISOString(),
      days,
    });

    let transfers;
    try {
      transfers = await fetchPlatformPaymentTransfers(
        platformAccount.balanceAccountId,
        since,
        until
      );
    } catch (err: any) {
      logger.error("[transactions/sync] Failed to fetch transfers from Adyen", {
        organizationId,
        error: err?.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch transfers from Adyen", detail: err?.message },
        { status: 502 }
      );
    }

    const synced = await backfillMissingTransactions(organizationId, transfers);

    // Refresh amount/fees/net on existing payouts so stale values from prior
    // (buggy) reconciliations get corrected and any newly-linked transactions
    // are reflected. Only payouts with linked transactions are processed.
    const recomputed = await recomputePayoutFinancials(organizationId);

    logger.info("[transactions/sync] Sync complete", {
      organizationId,
      total: transfers.length,
      synced,
      payoutsRecomputed: recomputed,
    });

    return NextResponse.json({
      synced,
      total: transfers.length,
      payoutsRecomputed: recomputed,
    });
  } catch (error) {
    logger.error("[transactions/sync] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
