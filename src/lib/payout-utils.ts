import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

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
