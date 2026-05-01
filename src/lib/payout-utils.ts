import { db, getScopedDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ReconciledVia } from "@prisma/client";
import type { AdyenPlatformPayment } from "@/lib/adyen-platform";

export type PayoutStatus = "PAID" | "SCHEDULED" | "FAILED" | "PENDING";

// Maps Adyen Balance Platform transfer status codes to our internal PayoutStatus.
// Source of truth for the sync route, webhook handler, and manual-payout initiate route.
export const TRANSFER_STATUS_MAP: Record<string, PayoutStatus> = {
  booked: "PAID",
  pendingApproval: "SCHEDULED",
  authorised: "SCHEDULED",
  received: "PENDING",
  failed: "FAILED",
  refused: "FAILED",
  returned: "FAILED",
  internallyDeclined: "FAILED",
  validationFailed: "FAILED",
};

/**
 * Coerces Adyen's transfer status (which may arrive as a bare string or as an
 * object with `statusCode` depending on the API surface) into our PayoutStatus.
 * Unknown statuses fall back to PENDING.
 */
export function mapTransferStatus(
  status: string | { statusCode?: string } | null | undefined
): PayoutStatus {
  const code = typeof status === "object" ? status?.statusCode : status;
  return TRANSFER_STATUS_MAP[code ?? ""] ?? "PENDING";
}

// Adyen appends a unique execution reference (e.g. "SWPE42CLR2235BR65P8L87243W36VX")
// to the sweep description when creating the transfer. This regex validates that suffix.
const ADYEN_SWEEP_REF_RE = /^SWPE\w+$/;

/**
 * Returns true if `desc` (already uppercased) matches `prefix` either exactly
 * or as a prefix followed by an Adyen sweep execution reference.
 */
function matchesSweepPrefix(desc: string, prefix: string): boolean {
  if (desc === prefix) return true;
  if (!desc.startsWith(prefix + " ")) return false;
  const suffix = desc.slice(prefix.length + 1);
  return ADYEN_SWEEP_REF_RE.test(suffix);
}

/**
 * Classify a transfer as SWEEP or MANUAL.
 *
 * When the sweep has a configured description, we match it as a prefix because
 * Adyen appends a unique execution reference (SWPE...) to that description on
 * the resulting transfer. The suffix is validated against Adyen's reference
 * pattern to avoid false positives from short or generic sweep descriptions.
 *
 * When no description is configured on the sweep, we fall back to Adyen's
 * auto-generated "EXT BAL SWEEP" prefix, which is exclusive to external
 * balance sweep transfers.
 *
 * Both strings are uppercased before comparison to guard against inconsistent
 * casing from Adyen (e.g. "Ext Bal Sweep" vs "EXT BAL SWEEP"). Adyen returns
 * these strings verbatim from its own stored values, so case variations between
 * a manual transfer and a sweep description are not expected in practice — the
 * ADYEN_SWEEP_REF_RE suffix check provides a secondary guard against the
 * theoretical case where a manual transfer description happens to match a
 * sweep description modulo case.
 */
export function determinePayoutType(
  transferDescription: string | null | undefined,
  sweepDescription: string | null | undefined
): "SWEEP" | "MANUAL" {
  const desc = (transferDescription ?? "").toUpperCase();
  const sweep = sweepDescription?.toUpperCase();
  if (sweep) {
    return matchesSweepPrefix(desc, sweep) ? "SWEEP" : "MANUAL";
  }
  return matchesSweepPrefix(desc, "EXT BAL SWEEP") ? "SWEEP" : "MANUAL";
}

export async function linkTransactionsToPayout(
  payoutId: string,
  organizationId: string,
  adyenTransfers?: AdyenPlatformPayment[]
): Promise<void> {
  try {
    const hasTransfers = Array.isArray(adyenTransfers) && adyenTransfers.length > 0;
    if (hasTransfers) {
      await linkByReferences(payoutId, organizationId, adyenTransfers!);
    } else {
      await linkByTimeWindow(payoutId, organizationId);
    }
  } catch (error) {
    logger.error("[PAYOUT] Failed to link transactions to payout", {
      payoutId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Creates stub Transaction rows for any pspPaymentReference returned by Adyen
// that has no corresponding record in our DB (e.g. missed Checkout webhook).
// Stubs have no paymentId/invoiceId linkage — they carry the financial data
// Adyen reported and are immediately available for payout reconciliation.
export async function backfillMissingTransactions(
  organizationId: string,
  transfers: AdyenPlatformPayment[]
): Promise<number> {
  const scopedDb = getScopedDb(organizationId);
  const refs = transfers.map((t) => t.pspReference);

  const existing = await scopedDb.transaction.findMany({
    where: { pspReference: { in: refs } },
    select: { pspReference: true },
  });

  const existingRefs = new Set(existing.map((t) => t.pspReference));
  const missing = transfers.filter((t) => !existingRefs.has(t.pspReference));
  if (missing.length === 0) return 0;

  await scopedDb.transaction.createMany({
    data: missing.map((t) => {
      // Sign convention: REFUND rows are stored as negative throughout the
      // codebase (e.g. adyen webhook, financials overview abs-after-sum). Keep
      // the sign of t.amount so backfilled rows match.
      const sign = t.amount >= 0 ? 1 : -1;
      const netAbs = Math.abs(t.amount);
      // gross = net + commission. Per our split config
      // (createPlatformSplitConfiguration), acquiringFees and adyenFees are
      // "deductFromLiableAccount" — they come out of OUR commission, not the
      // customer's payment. So the customer's gross is just what the org
      // received + what we kept as commission.
      const grossAbs = Math.round((netAbs + t.commissionAmount) * 100) / 100;

      // Store the exact Adyen-recorded commission as feeFixed (rate=0) so
      // calculatePayoutFees recovers `grossAmount * 0 + commission = commission`,
      // matching what Adyen actually deducted. For refunds the platform refunds
      // its commission too, so feeFixed must mirror amount's sign.
      return {
        organizationId,
        pspReference: t.pspReference,
        type: sign === 1 ? ("PAYMENT" as const) : ("REFUND" as const),
        amount: sign * grossAbs,
        currency: t.currency,
        status: "SETTLED" as const,
        method: t.method ?? null,
        settledAt: t.settledAt,
        description: "Adyen-synced",
        merchantRef: t.merchantRef ?? null,
        feeRate: 0,
        feeFixed: sign * t.commissionAmount,
      };
    }),
    skipDuplicates: true,
  });

  logger.info("[PAYOUT] Backfilled missing transactions from Adyen", {
    organizationId,
    count: missing.length,
  });

  return missing.length;
}

async function linkByReferences(
  payoutId: string,
  organizationId: string,
  transfers: AdyenPlatformPayment[]
): Promise<void> {
  const scopedDb = getScopedDb(organizationId);

  await backfillMissingTransactions(organizationId, transfers);

  // Include both primary and modification PSP refs in the match set.
  const refs = transfers.flatMap((t) =>
    t.modificationPspReference ? [t.pspReference, t.modificationPspReference] : [t.pspReference]
  );

  const result = await scopedDb.transaction.updateMany({
    where: {
      status: "SETTLED",
      payoutId: null,
      pspReference: { in: refs },
    },
    data: { payoutId },
  });

  logger.info("[PAYOUT] Linked transactions via REFERENCE_MATCH", {
    payoutId,
    strategy: "REFERENCE_MATCH",
    refsProvided: refs.length,
    transactionCount: result.count,
  });

  if (result.count > 0) {
    await scopedDb.payout.update({
      where: { id: payoutId },
      data: { reconciledVia: ReconciledVia.REFERENCE_MATCH },
    });
    await calculatePayoutFees(payoutId, organizationId);
  } else {
    logger.warn(
      "[PAYOUT] REFERENCE_MATCH returned 0 transactions after backfill, falling back to TIME_WINDOW",
      {
        payoutId,
        refsProvided: refs.length,
      }
    );
    await linkByTimeWindow(payoutId, organizationId);
  }
}

async function linkByTimeWindow(payoutId: string, organizationId: string): Promise<void> {
  const scopedDb = getScopedDb(organizationId);

  const payout = await scopedDb.payout.findUnique({
    where: { id: payoutId },
    select: { paidAt: true, reconciledVia: true },
  });
  if (!payout) return;

  if (payout.reconciledVia === ReconciledVia.REFERENCE_MATCH) {
    logger.info("[PAYOUT] Skipping TIME_WINDOW — already REFERENCE_MATCH", { payoutId });
    return;
  }

  const cutoff = payout.paidAt ?? new Date();

  const result = await scopedDb.transaction.updateMany({
    where: {
      status: "SETTLED",
      payoutId: null,
      settledAt: { lte: cutoff },
    },
    data: { payoutId },
  });

  logger.warn("[PAYOUT] Linked transactions via TIME_WINDOW heuristic", {
    payoutId,
    strategy: "TIME_WINDOW",
    cutoff: cutoff.toISOString(),
    transactionCount: result.count,
  });

  await scopedDb.payout.update({
    where: { id: payoutId },
    data: { reconciledVia: ReconciledVia.TIME_WINDOW },
  });

  if (result.count > 0) {
    await calculatePayoutFees(payoutId, organizationId);
  }
}

// Recompute amount/fees/net for payouts that contain at least one backfilled
// transaction (description = "Adyen-synced"). Webhook-flow payouts are skipped
// to avoid drift from approximate fee calculations on transactions whose stored
// rates don't perfectly reproduce Adyen's actual commission.
export async function recomputePayoutFinancials(organizationId: string): Promise<number> {
  const scopedDb = getScopedDb(organizationId);
  const payouts = await scopedDb.payout.findMany({
    where: { transactions: { some: { description: "Adyen-synced" } } },
    select: { id: true },
  });
  for (const payout of payouts) {
    await calculatePayoutFees(payout.id, organizationId);
  }
  return payouts.length;
}

async function calculatePayoutFees(payoutId: string, organizationId: string) {
  try {
    const scopedDb = getScopedDb(organizationId);

    const [transactions, org] = await Promise.all([
      scopedDb.transaction.findMany({
        where: { payoutId, status: "SETTLED" },
        select: { amount: true, feeRate: true, feeFixed: true },
      }),
      // Organization is not a tenant model — its id IS the org id, so use raw db.
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

    let totalGrossMinor = 0;
    let totalFeesMinor = 0;
    for (const txn of transactions) {
      const amount = Number(txn.amount);
      const rate = txn.feeRate != null ? Number(txn.feeRate) : fallbackRate;
      const fixed = txn.feeFixed != null ? Number(txn.feeFixed) : fallbackFixed;
      const txnFee = Math.round((amount * rate + fixed) * 100);
      totalGrossMinor += Math.round(amount * 100);
      totalFeesMinor += txnFee;
    }
    const totalGross = totalGrossMinor / 100;
    const totalFees = totalFeesMinor / 100;
    // payout.net is what actually arrived in the org's bank account; equal to the
    // sum of net-per-transaction amounts (gross minus our commission), which is
    // also what Adyen swept via the bank transfer.
    const net = Math.round(totalGrossMinor - totalFeesMinor) / 100;

    await scopedDb.payout.update({
      where: { id: payoutId },
      data: { amount: totalGross, fees: totalFees, net },
    });

    logger.info("[PAYOUT] Calculated platform fees for payout", {
      payoutId,
      amount: totalGross,
      fees: totalFees,
      net,
      transactionCount: transactions.length,
    });
  } catch (error) {
    logger.error("[PAYOUT] Failed to calculate payout fees", {
      payoutId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
