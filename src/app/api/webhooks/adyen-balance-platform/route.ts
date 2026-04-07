import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { extractHmacSignature } from "@/lib/adyen";
import { getTransferInstrumentLast4 } from "@/lib/adyen-platform";
import { deriveOnboardingStatus, summarizeVerification } from "@/lib/adyen-onboarding-status";

// ---------------------------------------------------------------------------
// HMAC verification (multi-key: one per webhook subscription)
// ---------------------------------------------------------------------------

function getBpHmacKeys(): string[] {
  return [
    process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY,
    process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY,
    process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY,
  ].filter(Boolean) as string[];
}

function verifyHmac(rawBody: string, parsedBody: any): boolean {
  const hmacKeys = getBpHmacKeys();
  const isStandardNotification = !!parsedBody?.notificationItems;
  const { hmacValidator } = require("@adyen/api-library");

  for (const hmacKey of hmacKeys) {
    try {
      if (isStandardNotification) {
        // Standard notification format: HMAC is computed over specific fields,
        // not the raw body. Use Adyen's library which knows the exact signing spec.
        const validator = new hmacValidator();
        const notificationItem = parsedBody.notificationItems[0]?.NotificationRequestItem;
        if (notificationItem && validator.validateHMAC(notificationItem, hmacKey)) {
          return true;
        }
      } else {
        // Balance Platform event format: HMAC is over the raw body string.
        const signature = parsedBody?.HmacSignature ?? "";
        const expected = crypto
          .createHmac("sha256", Buffer.from(hmacKey, "hex"))
          .update(rawBody, "utf-8")
          .digest("base64");

        if (
          signature.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
        ) {
          return true;
        }
      }
    } catch {
      continue;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.text();

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    parsedBody = body;
  }

  const hmacSignature = extractHmacSignature(request.headers, parsedBody);
  const hmacKeys = getBpHmacKeys();

  if (hmacKeys.length === 0) {
    logger.error("[BP-WEBHOOK] No HMAC keys configured (ADYEN_BP_*_WEBHOOK_HMAC_KEY)");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!hmacSignature) {
    logger.warn("[BP-WEBHOOK] Missing HMAC signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  if (!verifyHmac(body, parsedBody)) {
    logger.warn("[BP-WEBHOOK] HMAC verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Standard payment notification format (notificationItems) is handled by
  // /api/webhooks/adyen — acknowledge and skip to avoid double-processing.
  if (parsedBody?.notificationItems) {
    logger.info(
      "[BP-WEBHOOK] Standard notification format received — delegated to /api/webhooks/adyen"
    );
    return NextResponse.json({ notificationResponse: "[accepted]" }, { status: 200 });
  }

  try {
    const event = parsedBody;
    const eventType = event.type as string;

    logger.info("[BP-WEBHOOK] Event received", { type: eventType });

    switch (eventType) {
      case "balancePlatform.accountHolder.created":
        await handleAccountHolderCreated(event.data);
        break;
      case "balancePlatform.accountHolder.updated":
        await handleAccountHolderUpdated(event.data);
        break;
      case "balancePlatform.balanceAccount.created":
      case "balancePlatform.balanceAccount.updated":
        await handleBalanceAccountEvent(event.data, eventType);
        break;
      case "balancePlatform.transfer.created":
      case "balancePlatform.transfer.updated":
        await handleTransferEvent(event.data, eventType);
        break;
      case "balancePlatform.negativeBalanceCompensationWarning.scheduled":
        await handleNegativeBalanceWarning(event.data);
        break;
      default:
        logger.info("[BP-WEBHOOK] Unhandled event type", { type: eventType });
    }
  } catch (error) {
    logger.error("[BP-WEBHOOK] Processing error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Always return accepted to prevent Adyen retries
  return NextResponse.json({ notificationResponse: "[accepted]" }, { status: 200 });
}

// ---------------------------------------------------------------------------
// Account holder events
// ---------------------------------------------------------------------------

async function handleAccountHolderCreated(data: any) {
  const accountHolderId = data?.accountHolder?.id || data?.id;
  if (!accountHolderId) {
    logger.warn("[BP-WEBHOOK] accountHolder.created missing ID");
    return;
  }

  const account = await db.adyenPlatformAccount.findFirst({
    where: { accountHolderId },
  });

  if (account) {
    logger.info("[BP-WEBHOOK] accountHolder.created confirmed", {
      accountHolderId,
      organizationId: account.organizationId,
    });
  } else {
    logger.info("[BP-WEBHOOK] accountHolder.created for unknown account", {
      accountHolderId,
    });
  }
}

async function handleAccountHolderUpdated(data: any) {
  const accountHolder = data?.accountHolder || data;
  const accountHolderId = accountHolder?.id;
  if (!accountHolderId) {
    logger.warn("[BP-WEBHOOK] accountHolder.updated missing ID");
    return;
  }

  const account = await db.adyenPlatformAccount.findFirst({
    where: { accountHolderId },
  });

  if (!account) {
    logger.info("[BP-WEBHOOK] accountHolder.updated for unknown account", {
      accountHolderId,
    });
    return;
  }

  const capabilities = accountHolder.capabilities || {};
  const onboardingStatus = deriveOnboardingStatus(accountHolder);
  const verificationStatus = summarizeVerification(accountHolder);

  await db.adyenPlatformAccount.update({
    where: { id: account.id },
    data: {
      capabilities,
      onboardingStatus,
      verificationStatus,
    },
  });

  logger.info("[BP-WEBHOOK] accountHolder.updated processed", {
    accountHolderId,
    organizationId: account.organizationId,
    onboardingStatus,
    verificationStatus,
  });
}

// ---------------------------------------------------------------------------
// Balance account events
// ---------------------------------------------------------------------------

async function handleBalanceAccountEvent(data: any, eventType: string) {
  const balanceAccountId = data?.balanceAccount?.id || data?.id;
  logger.info("[BP-WEBHOOK] Balance account event", {
    type: eventType,
    balanceAccountId,
  });

  if (!balanceAccountId) return;

  const account = await db.adyenPlatformAccount.findFirst({
    where: { balanceAccountId },
  });

  if (account) {
    logger.info("[BP-WEBHOOK] Balance account matched to org", {
      balanceAccountId,
      organizationId: account.organizationId,
    });
  }
}

// ---------------------------------------------------------------------------
// Transfer events
// ---------------------------------------------------------------------------

async function handleTransferEvent(data: any, eventType: string) {
  const transfer = data?.transfer || data;
  const transferId = transfer?.id;
  const category = transfer?.category;
  const status = transfer?.status?.statusCode || transfer?.status;
  const amount = transfer?.amount;

  logger.info("[BP-WEBHOOK] Transfer event", {
    type: eventType,
    transferId,
    category,
    status,
    amount,
  });

  if (category === "bank") {
    await handleBankTransfer(transfer);
  }
  // Other categories (platformPayment, internalTransfer) logged for now;
  // detailed handling added in Phase 8
}

async function handleBankTransfer(transfer: any) {
  const balanceAccountId = transfer?.counterparty?.balanceAccountId || transfer?.balanceAccount?.id;

  if (!balanceAccountId) {
    logger.info("[BP-WEBHOOK] Bank transfer without balance account ID", {
      transferId: transfer?.id,
    });
    return;
  }

  const account = await db.adyenPlatformAccount.findFirst({
    where: { balanceAccountId },
    select: { organizationId: true },
  });

  if (!account) {
    logger.info("[BP-WEBHOOK] Bank transfer for unknown balance account", {
      balanceAccountId,
    });
    return;
  }

  const transferId = transfer.id;
  const amount = transfer.amount?.value ? Number(transfer.amount.value) / 100 : 0;
  const currency = transfer.amount?.currency || "USD";
  const status = transfer.status?.statusCode || transfer.status;

  const payoutStatus =
    status === "booked"
      ? "PAID"
      : status === "pendingApproval" || status === "authorised"
        ? "SCHEDULED"
        : status === "failed" || status === "refused" || status === "returned"
          ? "FAILED"
          : "PENDING";

  const estimatedArrivalTime =
    transfer?.tracking?.estimatedArrivalTime || extractEstimatedArrival(transfer?.events);

  const existingPayout = await db.payout.findFirst({
    where: { reference: transferId },
  });

  // Resolve bank account last 4 digits (only on first creation or if missing)
  let bankAccount: string | null = existingPayout?.bankAccount || null;
  if (!bankAccount && transfer?.counterparty?.transferInstrumentId) {
    bankAccount = await getTransferInstrumentLast4(transfer.counterparty.transferInstrumentId);
  }

  const updateData: Record<string, any> = {
    status: payoutStatus as any,
    ...(payoutStatus === "PAID" ? { paidAt: new Date() } : {}),
    ...(bankAccount ? { bankAccount } : {}),
    ...(estimatedArrivalTime ? { estimatedArrivalTime: new Date(estimatedArrivalTime) } : {}),
  };

  let payoutId: string;

  if (existingPayout) {
    await db.payout.update({
      where: { id: existingPayout.id },
      data: updateData,
    });
    payoutId = existingPayout.id;
    logger.info("[BP-WEBHOOK] Payout updated", {
      payoutId,
      status: payoutStatus,
    });
  } else {
    const created = await db.payout.create({
      data: {
        organizationId: account.organizationId,
        reference: transferId,
        amount,
        fees: 0,
        net: amount,
        currency,
        status: payoutStatus as any,
        bankAccount,
        ...(payoutStatus === "PAID" ? { paidAt: new Date() } : {}),
        ...(payoutStatus === "SCHEDULED" ? { scheduledAt: new Date() } : {}),
        ...(estimatedArrivalTime ? { estimatedArrivalTime: new Date(estimatedArrivalTime) } : {}),
      },
    });
    payoutId = created.id;
    logger.info("[BP-WEBHOOK] Payout created", {
      transferId,
      organizationId: account.organizationId,
      status: payoutStatus,
    });
  }

  // Link settled transactions to this payout when it reaches PAID status
  if (payoutStatus === "PAID") {
    await linkTransactionsToPayout(payoutId, account.organizationId);
  }
}

/**
 * Extract estimatedArrivalTime from the events array in the transfer webhook.
 * Adyen includes this in tracking events with type "tracking".
 */
function extractEstimatedArrival(events: any[] | undefined): string | null {
  if (!events) return null;
  for (const event of events) {
    if (event.type === "tracking" && event.trackingData?.estimatedArrivalTime) {
      return event.trackingData.estimatedArrivalTime;
    }
    if (event.estimatedArrivalTime) {
      return event.estimatedArrivalTime;
    }
  }
  return null;
}

/**
 * Link unsettled transactions (SETTLED status, no payoutId) to this payout.
 * Uses the payout's createdAt as a cutoff -- any transaction settled before
 * the payout was created belongs to it.
 */
async function linkTransactionsToPayout(payoutId: string, organizationId: string) {
  try {
    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      select: { createdAt: true },
    });
    if (!payout) return;

    const result = await db.transaction.updateMany({
      where: {
        organizationId,
        status: "SETTLED",
        payoutId: null,
        settledAt: { lte: payout.createdAt },
      },
      data: { payoutId },
    });

    if (result.count > 0) {
      logger.info("[BP-WEBHOOK] Linked transactions to payout", {
        payoutId,
        transactionCount: result.count,
      });

      // Calculate platform fees for linked transactions
      await calculatePayoutFees(payoutId, organizationId);
    }
  } catch (error) {
    logger.error("[BP-WEBHOOK] Failed to link transactions to payout", {
      payoutId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function calculatePayoutFees(payoutId: string, organizationId: string) {
  try {
    const [transactions, org] = await Promise.all([
      db.transaction.findMany({
        where: { payoutId, organizationId, status: "SETTLED" },
        select: { amount: true, feeRate: true, feeFixed: true },
      }),
      db.organization.findUnique({
        where: { id: organizationId },
        select: {
          subscription: {
            select: {
              plan: {
                select: {
                  transactionFee: true,
                  perTransactionFee: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const plan = org?.subscription?.plan;
    if (!plan || transactions.length === 0) return;

    // Fallback rates for transactions created before fee snapshot was added
    const fallbackRate = Number(plan.transactionFee);
    const fallbackFixed = Number(plan.perTransactionFee);

    let totalFeesMinor = 0;
    for (const txn of transactions) {
      const amount = Number(txn.amount);
      const rate = txn.feeRate != null ? Number(txn.feeRate) : fallbackRate;
      const fixed = txn.feeFixed != null ? Number(txn.feeFixed) : fallbackFixed;
      const txnFee = Math.round((amount * rate + fixed) * 100);
      totalFeesMinor += txnFee;
    }
    const totalFees = totalFeesMinor / 100;

    const payoutRecord = await db.payout.findUnique({
      where: { id: payoutId },
      select: { amount: true },
    });
    if (!payoutRecord) return;

    const payoutAmount = Number(payoutRecord.amount);
    const net = Math.round((payoutAmount - totalFees) * 100) / 100;

    await db.payout.update({
      where: { id: payoutId },
      data: { fees: totalFees, net },
    });

    logger.info("[BP-WEBHOOK] Calculated platform fees for payout", {
      payoutId,
      fees: totalFees,
      net,
      transactionCount: transactions.length,
    });
  } catch (error) {
    logger.error("[BP-WEBHOOK] Failed to calculate payout fees", {
      payoutId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Negative balance events
// ---------------------------------------------------------------------------

async function handleNegativeBalanceWarning(data: any) {
  const balanceAccountId = data?.balanceAccountId || data?.id;
  logger.warn("[BP-WEBHOOK] Negative balance compensation warning", {
    balanceAccountId,
  });

  if (!balanceAccountId) return;

  const account = await db.adyenPlatformAccount.findFirst({
    where: { balanceAccountId },
    select: { organizationId: true },
  });

  if (account) {
    logger.warn("[BP-WEBHOOK] Negative balance warning for organization", {
      balanceAccountId,
      organizationId: account.organizationId,
    });
    // Phase 7 will add: store negative balance state, trigger notifications
  }
}
