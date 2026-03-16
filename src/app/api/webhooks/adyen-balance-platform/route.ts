import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import crypto from "crypto"
import { AdyenOnboardingStatus } from "@prisma/client"

// ---------------------------------------------------------------------------
// HMAC verification (multi-key: one per webhook subscription)
// ---------------------------------------------------------------------------

function getBpHmacKeys(): string[] {
  return [
    process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY,
    process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY,
    process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY,
  ].filter(Boolean) as string[]
}

function verifyHmac(rawBody: string, signature: string): boolean {
  const hmacKeys = getBpHmacKeys()
  for (const hmacKey of hmacKeys) {
    try {
      const expected = crypto
        .createHmac("sha256", Buffer.from(hmacKey, "hex"))
        .update(rawBody, "utf-8")
        .digest("base64")

      if (
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.text()

  // Adyen sends HMAC in the "Hmacsignature" header (no hyphen)
  const hmacSignature =
    request.headers.get("hmacsignature") ||
    request.headers.get("hmac-signature") ||
    ""
  const hmacKeys = getBpHmacKeys()

  if (hmacKeys.length > 0 && hmacSignature) {
    if (!verifyHmac(body, hmacSignature)) {
      logger.warn("[BP-WEBHOOK] HMAC verification failed")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  try {
    const event = JSON.parse(body)
    const eventType = event.type as string

    logger.info("[BP-WEBHOOK] Event received", { type: eventType })

    switch (eventType) {
      case "balancePlatform.accountHolder.created":
        await handleAccountHolderCreated(event.data)
        break
      case "balancePlatform.accountHolder.updated":
        await handleAccountHolderUpdated(event.data)
        break
      case "balancePlatform.balanceAccount.created":
      case "balancePlatform.balanceAccount.updated":
        await handleBalanceAccountEvent(event.data, eventType)
        break
      case "balancePlatform.transfer.created":
      case "balancePlatform.transfer.updated":
        await handleTransferEvent(event.data, eventType)
        break
      case "balancePlatform.negativeBalanceCompensationWarning.scheduled":
        await handleNegativeBalanceWarning(event.data)
        break
      default:
        logger.info("[BP-WEBHOOK] Unhandled event type", { type: eventType })
    }
  } catch (error) {
    logger.error("[BP-WEBHOOK] Processing error", {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Always return accepted to prevent Adyen retries
  return NextResponse.json({ notificationResponse: "[accepted]" })
}

// ---------------------------------------------------------------------------
// Account holder events
// ---------------------------------------------------------------------------

async function handleAccountHolderCreated(data: any) {
  const accountHolderId = data?.accountHolder?.id || data?.id
  if (!accountHolderId) {
    logger.warn("[BP-WEBHOOK] accountHolder.created missing ID")
    return
  }

  const account = await db.adyenPlatformAccount.findFirst({
    where: { accountHolderId },
  })

  if (account) {
    logger.info("[BP-WEBHOOK] accountHolder.created confirmed", {
      accountHolderId,
      organizationId: account.organizationId,
    })
  } else {
    logger.info("[BP-WEBHOOK] accountHolder.created for unknown account", {
      accountHolderId,
    })
  }
}

async function handleAccountHolderUpdated(data: any) {
  const accountHolder = data?.accountHolder || data
  const accountHolderId = accountHolder?.id
  if (!accountHolderId) {
    logger.warn("[BP-WEBHOOK] accountHolder.updated missing ID")
    return
  }

  const account = await db.adyenPlatformAccount.findFirst({
    where: { accountHolderId },
  })

  if (!account) {
    logger.info("[BP-WEBHOOK] accountHolder.updated for unknown account", {
      accountHolderId,
    })
    return
  }

  const capabilities = accountHolder.capabilities || {}
  const onboardingStatus = deriveOnboardingStatus(accountHolder)
  const verificationStatus = summarizeVerification(accountHolder)

  await db.adyenPlatformAccount.update({
    where: { id: account.id },
    data: {
      capabilities,
      onboardingStatus,
      verificationStatus,
    },
  })

  logger.info("[BP-WEBHOOK] accountHolder.updated processed", {
    accountHolderId,
    organizationId: account.organizationId,
    onboardingStatus,
    verificationStatus,
  })
}

function deriveOnboardingStatus(accountHolder: any): AdyenOnboardingStatus {
  const capabilities = accountHolder.capabilities || {}
  const capEntries = Object.values(capabilities) as any[]

  if (capEntries.length === 0) {
    return AdyenOnboardingStatus.PENDING_HOSTED
  }

  const allAllowed = capEntries.every((c: any) => c.allowed === true)
  if (allAllowed) {
    return AdyenOnboardingStatus.VERIFIED
  }

  const hasProblems = capEntries.some(
    (c: any) => c.problems && c.problems.length > 0
  )

  if (hasProblems) {
    // Check if problems are actionable (dataMissing) vs terminal (rejected)
    const allProblems = capEntries.flatMap((c: any) => c.problems || [])
    const hasDataMissing = allProblems.some(
      (p: any) =>
        p.entity?.type === "LegalEntity" &&
        p.verificationErrors?.some((e: any) => e.type === "dataMissing")
    )
    const hasRejected = allProblems.some((p: any) =>
      p.verificationErrors?.some((e: any) => e.type === "rejected")
    )

    if (hasRejected) {
      return AdyenOnboardingStatus.REJECTED
    }
    if (hasDataMissing) {
      return AdyenOnboardingStatus.AWAITING_DATA
    }
  }

  const anyPending = capEntries.some(
    (c: any) => c.verificationStatus === "pending"
  )
  if (anyPending) {
    return AdyenOnboardingStatus.IN_REVIEW
  }

  return AdyenOnboardingStatus.IN_PROGRESS
}

function summarizeVerification(accountHolder: any): string {
  const capabilities = accountHolder.capabilities || {}
  const entries = Object.entries(capabilities) as [string, any][]

  if (entries.length === 0) return "No capabilities"

  const allowed = entries.filter(([, c]) => c.allowed === true).length
  const pending = entries.filter(
    ([, c]) => c.verificationStatus === "pending"
  ).length
  const total = entries.length

  if (allowed === total) return "All capabilities verified"
  if (pending > 0) return `${pending}/${total} capabilities pending verification`

  const problems = entries.flatMap(([, c]) => c.problems || [])
  const errorCount = problems.reduce(
    (sum: number, p: any) => sum + (p.verificationErrors?.length || 0),
    0
  )
  if (errorCount > 0) return `${errorCount} verification error(s) to resolve`

  return `${allowed}/${total} capabilities allowed`
}

// ---------------------------------------------------------------------------
// Balance account events
// ---------------------------------------------------------------------------

async function handleBalanceAccountEvent(data: any, eventType: string) {
  const balanceAccountId = data?.balanceAccount?.id || data?.id
  logger.info("[BP-WEBHOOK] Balance account event", {
    type: eventType,
    balanceAccountId,
  })

  if (!balanceAccountId) return

  const account = await db.adyenPlatformAccount.findFirst({
    where: { balanceAccountId },
  })

  if (account) {
    logger.info("[BP-WEBHOOK] Balance account matched to org", {
      balanceAccountId,
      organizationId: account.organizationId,
    })
  }
}

// ---------------------------------------------------------------------------
// Transfer events
// ---------------------------------------------------------------------------

async function handleTransferEvent(data: any, eventType: string) {
  const transfer = data?.transfer || data
  const transferId = transfer?.id
  const category = transfer?.category
  const status = transfer?.status?.statusCode || transfer?.status
  const amount = transfer?.amount

  logger.info("[BP-WEBHOOK] Transfer event", {
    type: eventType,
    transferId,
    category,
    status,
    amount,
  })

  if (category === "bank") {
    await handleBankTransfer(transfer)
  }
  // Other categories (platformPayment, internalTransfer) logged for now;
  // detailed handling added in Phase 8
}

async function handleBankTransfer(transfer: any) {
  const balanceAccountId =
    transfer?.counterparty?.balanceAccountId ||
    transfer?.balanceAccount?.id

  if (!balanceAccountId) {
    logger.info("[BP-WEBHOOK] Bank transfer without balance account ID", {
      transferId: transfer?.id,
    })
    return
  }

  const account = await db.adyenPlatformAccount.findFirst({
    where: { balanceAccountId },
    select: { organizationId: true },
  })

  if (!account) {
    logger.info("[BP-WEBHOOK] Bank transfer for unknown balance account", {
      balanceAccountId,
    })
    return
  }

  const transferId = transfer.id
  const amount = transfer.amount?.value
    ? Number(transfer.amount.value) / 100
    : 0
  const currency = transfer.amount?.currency || "USD"
  const status = transfer.status?.statusCode || transfer.status

  const existingPayout = await db.payout.findFirst({
    where: { reference: transferId },
  })

  const payoutStatus =
    status === "booked"
      ? "PAID"
      : status === "pendingApproval" || status === "authorised"
        ? "SCHEDULED"
        : status === "failed" || status === "refused" || status === "returned"
          ? "FAILED"
          : "PENDING"

  if (existingPayout) {
    await db.payout.update({
      where: { id: existingPayout.id },
      data: {
        status: payoutStatus as any,
        ...(payoutStatus === "PAID" ? { paidAt: new Date() } : {}),
      },
    })
    logger.info("[BP-WEBHOOK] Payout updated", {
      payoutId: existingPayout.id,
      status: payoutStatus,
    })
  } else {
    await db.payout.create({
      data: {
        organizationId: account.organizationId,
        reference: transferId,
        amount,
        fees: 0,
        net: amount,
        currency,
        status: payoutStatus as any,
        ...(payoutStatus === "PAID" ? { paidAt: new Date() } : {}),
        ...(payoutStatus === "SCHEDULED"
          ? { scheduledAt: new Date() }
          : {}),
      },
    })
    logger.info("[BP-WEBHOOK] Payout created", {
      transferId,
      organizationId: account.organizationId,
      status: payoutStatus,
    })
  }
}

// ---------------------------------------------------------------------------
// Negative balance events
// ---------------------------------------------------------------------------

async function handleNegativeBalanceWarning(data: any) {
  const balanceAccountId = data?.balanceAccountId || data?.id
  logger.warn("[BP-WEBHOOK] Negative balance compensation warning", {
    balanceAccountId,
  })

  if (!balanceAccountId) return

  const account = await db.adyenPlatformAccount.findFirst({
    where: { balanceAccountId },
    select: { organizationId: true },
  })

  if (account) {
    logger.warn(
      "[BP-WEBHOOK] Negative balance warning for organization",
      {
        balanceAccountId,
        organizationId: account.organizationId,
      }
    )
    // Phase 7 will add: store negative balance state, trigger notifications
  }
}
