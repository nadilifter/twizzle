import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import {
  listBalanceAccountTransfers,
  getTransferInstrumentLast4,
  getBalanceAccountSweepDescription,
} from "@/lib/adyen-platform";
import {
  linkTransactionsToPayout,
  determinePayoutType,
  mapTransferStatus,
} from "@/lib/payout-utils";
import { redis } from "@/lib/redis";

const THROTTLE_KEY = (orgId: string) => `payout-sync:${orgId}`;
const SYNC_THROTTLE_SECONDS = 30 * 60;

const SYNC_THROTTLE_MS = SYNC_THROTTLE_SECONDS * 1000;

// POST /api/payouts/sync - Upsert Payout records from Adyen Transfers API
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const force = new URL(request.url).searchParams.get("force") === "true";

    // Throttle check via Redis — avoids any DB call when we're still within the window
    if (!force && redis) {
      const cached = await redis.get(THROTTLE_KEY(organizationId));
      if (cached) {
        return NextResponse.json({ skipped: true, synced: 0, total: 0 });
      }
    }

    const platformAccount = await db.adyenPlatformAccount.findUnique({
      where: { organizationId, accountStatus: "ACTIVE" },
      select: {
        balanceAccountId: true,
        transferInstrumentId: true,
        sweepId: true,
        lastPayoutSyncAt: true,
      },
    });

    if (!platformAccount?.balanceAccountId) {
      return NextResponse.json(
        { error: "No active Adyen balance account found for this organization" },
        { status: 404 }
      );
    }

    // Fallback: if Redis is unavailable, use DB's lastPayoutSyncAt
    if (!force && !redis) {
      const lastSync = platformAccount.lastPayoutSyncAt;
      if (lastSync && Date.now() - lastSync.getTime() < SYNC_THROTTLE_MS) {
        return NextResponse.json({ skipped: true, synced: 0, total: 0 });
      }
    }

    const { balanceAccountId, transferInstrumentId, sweepId } = platformAccount;

    let transfers: any[];
    try {
      transfers = await listBalanceAccountTransfers(balanceAccountId);
    } catch (adyenError: any) {
      const status = adyenError.statusCode ?? 500;
      const detail = adyenError.responseBody
        ? JSON.parse(adyenError.responseBody)?.title
        : adyenError.message;
      return NextResponse.json(
        { error: "Failed to fetch transfers from Adyen", detail, adyenStatus: status },
        { status: 502 }
      );
    }

    const [sweepDescription, orgLast4] = await Promise.all([
      sweepId
        ? getBalanceAccountSweepDescription(balanceAccountId, sweepId)
        : Promise.resolve(null),
      transferInstrumentId
        ? getTransferInstrumentLast4(transferInstrumentId)
        : Promise.resolve(null),
    ]);

    if (transfers.length === 0) {
      await Promise.all([
        db.adyenPlatformAccount.update({
          where: { organizationId },
          data: { lastPayoutSyncAt: new Date() },
        }),
        redis?.set(THROTTLE_KEY(organizationId), "1", { ex: SYNC_THROTTLE_SECONDS }),
      ]);
      return NextResponse.json({ synced: 0, total: 0 });
    }

    const scopedDb = getScopedDb(organizationId);
    let synced = 0;

    for (const transfer of transfers) {
      if (!transfer.id) continue;

      const transferId = transfer.id as string;
      const payoutStatus = mapTransferStatus(transfer.status);
      const amount = transfer.amount?.value ? Number(transfer.amount.value) / 100 : 0;
      const currency = transfer.amount?.currency ?? "USD";
      // Use the transfer's own creation date, not the backfill time
      const transferDate = transfer.createdAt ? new Date(transfer.createdAt) : new Date();

      const transferInstrumentIdFromTransfer = transfer?.counterparty?.transferInstrumentId;
      let bankAccount = orgLast4;
      if (!bankAccount && transferInstrumentIdFromTransfer) {
        bankAccount = await getTransferInstrumentLast4(transferInstrumentIdFromTransfer);
      }

      const payoutType = determinePayoutType(transfer.description, sweepDescription);

      const estimatedArrivalTime = transfer?.tracking?.estimatedArrivalTime ?? null;

      const upserted = await scopedDb.payout.upsert({
        where: { reference: transferId },
        create: {
          organizationId,
          reference: transferId,
          amount,
          fees: 0,
          net: amount,
          currency,
          status: payoutStatus,
          payoutType,
          bankAccount,
          ...(payoutStatus === "PAID" ? { paidAt: transferDate } : {}),
          ...(payoutStatus === "SCHEDULED" ? { scheduledAt: transferDate } : {}),
          ...(estimatedArrivalTime ? { estimatedArrivalTime: new Date(estimatedArrivalTime) } : {}),
        },
        update: {
          status: payoutStatus,
          // Always overwrite so re-sync self-corrects misclassified records; see determinePayoutType.
          payoutType,
          ...(bankAccount ? { bankAccount } : {}),
          ...(payoutStatus === "PAID" ? { paidAt: transferDate } : {}),
          ...(payoutStatus === "SCHEDULED" ? { scheduledAt: transferDate } : {}),
          ...(estimatedArrivalTime ? { estimatedArrivalTime: new Date(estimatedArrivalTime) } : {}),
        },
      });

      if (payoutStatus === "PAID") {
        await linkTransactionsToPayout(upserted.id, organizationId);
      }

      synced++;
    }

    await Promise.all([
      db.adyenPlatformAccount.update({
        where: { organizationId },
        data: { lastPayoutSyncAt: new Date() },
      }),
      redis?.set(THROTTLE_KEY(organizationId), "1", { ex: SYNC_THROTTLE_SECONDS }),
    ]);

    return NextResponse.json({
      synced,
      total: transfers.length,
    });
  } catch (error) {
    console.error("Error syncing payouts:", error);
    return NextResponse.json({ error: "Failed to sync payouts" }, { status: 500 });
  }
}
