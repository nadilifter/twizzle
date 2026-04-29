import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthSession } from "@/lib/auth";
import db, { getScopedDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  initiateTransfer,
  getTransferInstrumentLast4,
  getBalanceAccountBalance,
} from "@/lib/adyen-platform";
import { mapTransferStatus } from "@/lib/payout-utils";

function parseAdyenError(error: any): { detail?: string; title?: string; message?: string } {
  if (!error?.responseBody) return {};
  try {
    return typeof error.responseBody === "string"
      ? JSON.parse(error.responseBody)
      : error.responseBody;
  } catch {
    return { message: String(error.responseBody) };
  }
}

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions;
    if (!permissions.includes("*") && !permissions.includes("financials.admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgId = session.user.organizationId;

    const scopedDb = getScopedDb(orgId);

    const account = await db.adyenPlatformAccount.findUnique({
      where: {
        organizationId: orgId,
        accountStatus: "ACTIVE",
      },
      select: {
        balanceAccountId: true,
        transferInstrumentId: true,
        onboardingStatus: true,
      },
    });

    if (!account || account.onboardingStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: "Account must be verified before initiating payouts" },
        { status: 422 }
      );
    }

    if (!account.balanceAccountId) {
      return NextResponse.json({ error: "Balance account not configured" }, { status: 422 });
    }

    if (!account.transferInstrumentId) {
      return NextResponse.json(
        { error: "No bank account linked. Complete onboarding first." },
        { status: 422 }
      );
    }

    const liveBalance = await getBalanceAccountBalance(account.balanceAccountId);
    logger.info("[payouts/initiate] Live balance fetched", {
      organizationId: session.user.organizationId,
      balanceAccountId: account.balanceAccountId,
      liveBalance,
    });
    if (!liveBalance || liveBalance.available <= 0) {
      return NextResponse.json({ error: "No available balance to pay out" }, { status: 422 });
    }

    // Use a single UUID as both Adyen's Idempotency-Key and the local placeholder
    // reference. Persisting it on the Payout row before the Adyen call means a
    // retry of the same request reuses the same key (Adyen dedupes within ~24h),
    // and a webhook arriving for the resulting transfer can still find this row
    // via the matching reference if our post-call update fails.
    const idempotencyKey = randomUUID();
    const placeholderReference = `manual-${idempotencyKey}`;
    const amountMinorUnits = Math.round(liveBalance.available * 100);

    const bankAccount = await getTransferInstrumentLast4(account.transferInstrumentId);
    if (!bankAccount) {
      logger.error("[payouts/initiate] Could not resolve bank account last4", {
        organizationId: orgId,
        transferInstrumentId: account.transferInstrumentId,
      });
      return NextResponse.json(
        {
          error:
            "Could not resolve linked bank account details. Please retry or contact support if this persists.",
        },
        { status: 422 }
      );
    }

    const payout = await scopedDb.payout.create({
      data: {
        organizationId: session.user.organizationId,
        reference: placeholderReference,
        amount: liveBalance.available,
        fees: 0,
        net: liveBalance.available,
        currency: liveBalance.currency,
        status: "PENDING",
        payoutType: "MANUAL",
        bankAccount,
      },
    });

    logger.info("[payouts/initiate] Calling Adyen transferFunds", {
      payoutId: payout.id,
      organizationId: session.user.organizationId,
      balanceAccountId: account.balanceAccountId,
      transferInstrumentId: account.transferInstrumentId,
      amountMinorUnits,
      currency: liveBalance.currency,
      idempotencyKey,
    });

    let transfer: {
      id: string;
      status: string | { statusCode?: string };
      amount?: { value?: number; currency?: string };
    };
    try {
      transfer = await initiateTransfer(
        account.balanceAccountId,
        account.transferInstrumentId,
        { value: amountMinorUnits, currency: liveBalance.currency },
        placeholderReference,
        idempotencyKey
      );
    } catch (error: any) {
      const body = parseAdyenError(error);
      logger.error("[payouts/initiate] Adyen transferFunds failed", {
        payoutId: payout.id,
        organizationId: session.user.organizationId,
        balanceAccountId: account.balanceAccountId,
        transferInstrumentId: account.transferInstrumentId,
        amountMinorUnits,
        currency: liveBalance.currency,
        idempotencyKey,
        statusCode: error?.statusCode,
        adyenErrorCode: (body as any)?.errorCode,
        adyenTitle: body?.title,
        adyenDetail: body?.detail,
        adyenMessage: body?.message,
        invalidFields: (body as any)?.invalidFields,
        rawResponseBody: error?.responseBody,
      });
      await scopedDb.payout.update({
        where: { id: payout.id },
        data: { status: "FAILED" },
      });
      const message = body?.detail || body?.title || body?.message || "Transfer initiation failed";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    // Translate Adyen's synchronous transfer status into our PayoutStatus so the
    // row reflects reality immediately instead of sitting on PENDING until the
    // webhook arrives. Webhook/sync still flips it to PAID once the transfer
    // settles ("booked").
    const payoutStatus = mapTransferStatus(transfer.status);
    const now = new Date();

    logger.info("[payouts/initiate] Adyen transferFunds succeeded", {
      payoutId: payout.id,
      transferId: transfer.id,
      transferStatus: transfer.status,
      mappedStatus: payoutStatus,
    });

    const updated = await scopedDb.payout.update({
      where: { id: payout.id },
      data: {
        reference: transfer.id,
        status: payoutStatus,
        ...(payoutStatus === "PAID" ? { paidAt: now } : {}),
        ...(payoutStatus === "SCHEDULED" ? { scheduledAt: now } : {}),
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    logger.error("[payouts/initiate] Unexpected error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
