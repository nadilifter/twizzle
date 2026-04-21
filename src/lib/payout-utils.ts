import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

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

export async function linkTransactionsToPayout(payoutId: string, organizationId: string) {
  try {
    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      select: { paidAt: true },
    });
    if (!payout) return;

    // Use paidAt (actual transfer date) so synced payouts don't over-link
    // transactions settled after the transfer went out
    const cutoff = payout.paidAt ?? new Date();

    const result = await db.transaction.updateMany({
      where: {
        organizationId,
        status: "SETTLED",
        payoutId: null,
        settledAt: { lte: cutoff },
      },
      data: { payoutId },
    });

    if (result.count > 0) {
      logger.info("[PAYOUT] Linked transactions to payout", {
        payoutId,
        transactionCount: result.count,
      });

      await calculatePayoutFees(payoutId, organizationId);
    }
  } catch (error) {
    logger.error("[PAYOUT] Failed to link transactions to payout", {
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

    logger.info("[PAYOUT] Calculated platform fees for payout", {
      payoutId,
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
