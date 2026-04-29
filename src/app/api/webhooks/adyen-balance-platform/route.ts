import { NextRequest, NextResponse } from "next/server";
import { db, getScopedDb } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { extractHmacSignature } from "@/lib/adyen";
import {
  getTransferInstrumentLast4,
  getBalanceAccountSweepDescription,
  setSweepStatus,
} from "@/lib/adyen-platform";
import { handleVerificationRecovery } from "@/lib/adyen-onboarding-recovery";
import {
  linkTransactionsToPayout,
  determinePayoutType,
  mapTransferStatus,
} from "@/lib/payout-utils";
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

function verifyHmac(rawBody: string, parsedBody: any, signature: string): boolean {
  const hmacKeys = getBpHmacKeys();
  const isStandardNotification = !!parsedBody?.notificationItems;
  const { hmacValidator } = require("@adyen/api-library");

  const attempts: Array<{ keyIndex: number; matched: boolean; error?: string }> = [];

  for (let i = 0; i < hmacKeys.length; i++) {
    const hmacKey = hmacKeys[i];
    try {
      if (isStandardNotification) {
        // Standard notification format: HMAC is computed over specific fields,
        // not the raw body. Use Adyen's library which knows the exact signing spec.
        const validator = new hmacValidator();
        const notificationItem = parsedBody.notificationItems[0]?.NotificationRequestItem;
        const matched = !!(notificationItem && validator.validateHMAC(notificationItem, hmacKey));
        attempts.push({ keyIndex: i, matched });
        if (matched) return true;
      } else {
        // Balance Platform event format: HMAC is over the raw body string.
        // Adyen delivers the signature in the `hmacsignature` request header
        // (extractHmacSignature also accepts an in-body fallback).
        const expected = crypto
          .createHmac("sha256", Buffer.from(hmacKey, "hex"))
          .update(rawBody, "utf-8")
          .digest("base64");

        const matched =
          signature.length > 0 &&
          signature.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

        attempts.push({ keyIndex: i, matched });
        if (matched) return true;
      }
    } catch (error) {
      attempts.push({
        keyIndex: i,
        matched: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.warn("[BP-WEBHOOK] HMAC mismatch — none of the configured keys matched", {
    keysTried: hmacKeys.length,
    isStandardNotification,
    signaturePresent: signature.length > 0,
    bodyLength: rawBody.length,
    attempts,
  });
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractRegressionErrors(capabilities: Record<string, any>): Record<string, any[]> {
  const errors: Record<string, any[]> = {};
  for (const [capability, details] of Object.entries(capabilities)) {
    const problems: any[] = details?.problems ?? [];
    const verificationErrors = problems.flatMap((p: any) => p.verificationErrors ?? []);
    if (verificationErrors.length > 0) {
      errors[capability] = verificationErrors;
    }
  }
  return errors;
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

  // Standard payment notification format (notificationItems) is handled by
  // /api/webhooks/adyen — acknowledge and skip to avoid double-processing.
  // This must run BEFORE the BP HMAC check, since standard notifications are
  // signed with ADYEN_WEBHOOK_HMAC_KEY (not the BP-scoped keys) and would always
  // 401 against verifyHmac's BP keyset.
  if (parsedBody?.notificationItems) {
    logger.info(
      "[BP-WEBHOOK] Standard notification format received — delegated to /api/webhooks/adyen",
      {
        eventCode: parsedBody.notificationItems[0]?.NotificationRequestItem?.eventCode,
        pspReference: parsedBody.notificationItems[0]?.NotificationRequestItem?.pspReference,
      }
    );
    return NextResponse.json({ notificationResponse: "[accepted]" }, { status: 200 });
  }

  const skipHmac =
    process.env.NODE_ENV !== "production" && process.env.SKIP_WEBHOOK_HMAC === "true";

  if (!skipHmac) {
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

    if (!verifyHmac(body, parsedBody, hmacSignature)) {
      logger.warn("[BP-WEBHOOK] HMAC verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    logger.warn("[BP-WEBHOOK] HMAC verification skipped (SKIP_WEBHOOK_HMAC=true)");
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

  const holderStatus = accountHolder.status as string | undefined;
  const accountStatus =
    holderStatus === "Suspended" || holderStatus === "Closed" || holderStatus === "Inactive"
      ? "INACTIVE"
      : "ACTIVE";

  const previousStatus = account.onboardingStatus;
  const isRegression = previousStatus === "VERIFIED" && onboardingStatus !== "VERIFIED";
  const isRecovery = previousStatus !== "VERIFIED" && onboardingStatus === "VERIFIED";

  if (isRegression) {
    logger.warn("[BP-WEBHOOK] Onboarding status regression detected", {
      accountHolderId,
      organizationId: account.organizationId,
      previousStatus,
      newStatus: onboardingStatus,
    });
  }

  const updateData: Record<string, any> = {
    capabilities,
    onboardingStatus,
    verificationStatus,
    accountStatus,
  };

  // Set verifiedAt once when the account first reaches VERIFIED; never clear it on regression
  if (onboardingStatus === "VERIFIED" && !account.verifiedAt) {
    updateData.verifiedAt = new Date();
  }

  // Stamp regressionAt each time the account regresses so recovery logic can compare timestamps
  if (isRegression) {
    updateData.regressionAt = new Date();
    updateData.regressionErrors = extractRegressionErrors(capabilities);
  }

  if (isRecovery) {
    updateData.regressionErrors = null;
  }

  await db.adyenPlatformAccount.update({
    where: { id: account.id },
    data: updateData,
  });

  // On regression: disable the payout sweep and unpublish the marketing site
  if (isRegression) {
    if (account.balanceAccountId && account.sweepId) {
      try {
        await setSweepStatus(account.balanceAccountId, account.sweepId, "inactive");
        logger.warn("[BP-WEBHOOK] Sweep disabled due to onboarding regression", {
          organizationId: account.organizationId,
          sweepId: account.sweepId,
        });
      } catch {
        logger.error("[BP-WEBHOOK] Failed to disable sweep on regression", {
          organizationId: account.organizationId,
          sweepId: account.sweepId,
        });
      }
    }

    try {
      await db.websiteConfig.updateMany({
        where: { organizationId: account.organizationId, isPublished: true },
        data: { isPublished: false },
      });
      logger.warn("[BP-WEBHOOK] Website unpublished due to onboarding regression", {
        organizationId: account.organizationId,
      });
    } catch {
      logger.error("[BP-WEBHOOK] Failed to unpublish website on regression", {
        organizationId: account.organizationId,
      });
    }
  }

  // On recovery: re-enable sweep and conditionally republish website
  if (isRecovery) {
    await handleVerificationRecovery(account);
  }

  logger.info("[BP-WEBHOOK] accountHolder.updated processed", {
    accountHolderId,
    organizationId: account.organizationId,
    onboardingStatus,
    verificationStatus,
    ...(isRegression && { regression: true, previousStatus }),
    ...(isRecovery && { recovery: true, previousStatus }),
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

interface AdyenBankTransfer {
  id: string;
  reference?: string;
  description?: string;
  createdAt?: string;
  balanceAccountId?: string;
  balanceAccount?: { id?: string };
  amount?: { value?: number; currency?: string };
  status?: { statusCode?: string } | string;
  tracking?: { estimatedArrivalTime?: string };
  events?: { type?: string; trackingData?: { estimatedArrivalTime?: string } }[];
  counterparty?: { balanceAccountId?: string; transferInstrumentId?: string };
}

async function handleBankTransfer(transfer: AdyenBankTransfer) {
  const balanceAccountId =
    transfer?.balanceAccountId ||
    transfer?.balanceAccount?.id ||
    transfer?.counterparty?.balanceAccountId;

  if (!balanceAccountId) {
    logger.warn(
      "[BP-WEBHOOK] Bank transfer: could not extract balanceAccountId — payout not created",
      {
        transferId: transfer?.id,
        transferKeys: Object.keys(transfer || {}),
      }
    );
    return;
  }

  const account = await db.adyenPlatformAccount.findFirst({
    where: { balanceAccountId },
    select: { organizationId: true, sweepId: true },
  });

  if (!account) {
    logger.info("[BP-WEBHOOK] Bank transfer for unknown balance account", {
      balanceAccountId,
    });
    return;
  }

  const scopedDb = getScopedDb(account.organizationId);

  const transferId = transfer.id;
  const amount = transfer.amount?.value ? Number(transfer.amount.value) / 100 : 0;
  const currency = transfer.amount?.currency || "USD";
  const transferDate = transfer.createdAt ? new Date(transfer.createdAt) : new Date();
  const sweepDescription = account.sweepId
    ? await getBalanceAccountSweepDescription(balanceAccountId, account.sweepId)
    : null;
  const payoutType = determinePayoutType(transfer.description, sweepDescription);

  const payoutStatus = mapTransferStatus(transfer.status);

  const estimatedArrivalTime =
    transfer?.tracking?.estimatedArrivalTime || extractEstimatedArrival(transfer?.events);

  // Match by Adyen transferId first; fall back to the Adyen-side reference we
  // submitted (e.g. "manual-<uuid>" for manually-initiated payouts). The fallback
  // catches pre-created Payout rows whose post-call reference→transferId update
  // never landed, preventing a duplicate row from being created here.
  const adyenReference = transfer.reference;
  const existingPayout = await scopedDb.payout.findFirst({
    where: adyenReference
      ? { OR: [{ reference: transferId }, { reference: adyenReference }] }
      : { reference: transferId },
  });

  // Resolve bank account last 4 digits (only on first creation or if missing)
  let bankAccount: string | null = existingPayout?.bankAccount || null;
  if (!bankAccount && transfer?.counterparty?.transferInstrumentId) {
    bankAccount = await getTransferInstrumentLast4(transfer.counterparty.transferInstrumentId);
  }

  const updateData: Prisma.PayoutUpdateInput = {
    status: payoutStatus,
    // Always overwrite so webhooks self-correct misclassified records; see determinePayoutType.
    payoutType,
    ...(payoutStatus === "PAID" ? { paidAt: transferDate } : {}),
    ...(payoutStatus === "SCHEDULED" ? { scheduledAt: transferDate } : {}),
    ...(bankAccount ? { bankAccount } : {}),
    ...(estimatedArrivalTime ? { estimatedArrivalTime: new Date(estimatedArrivalTime) } : {}),
  };

  let payoutId: string;

  if (existingPayout) {
    await scopedDb.payout.update({
      where: { id: existingPayout.id },
      data: {
        ...updateData,
        // If matched via the placeholder reference, upgrade to the real Adyen
        // transfer ID so subsequent webhooks for this transfer match directly.
        ...(existingPayout.reference !== transferId ? { reference: transferId } : {}),
      },
    });
    payoutId = existingPayout.id;
    logger.info("[BP-WEBHOOK] Payout updated", {
      payoutId,
      status: payoutStatus,
    });
  } else {
    const created = await scopedDb.payout.create({
      data: {
        organizationId: account.organizationId,
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
