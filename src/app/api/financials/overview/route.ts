import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBalanceAccountBalance } from "@/lib/adyen-platform";

type PaymentWithFees = {
  amount: { toNumber?: () => number } | number | string;
  transaction: {
    feeRate: { toNumber?: () => number } | number | string | null;
    feeFixed: { toNumber?: () => number } | number | string | null;
  } | null;
};

function platformFee(p: PaymentWithFees): number {
  const amount = Number(p.amount);
  const t = p.transaction;
  if (!t) return 0;
  return Math.floor((amount * Number(t.feeRate ?? 0) + Number(t.feeFixed ?? 0)) * 100) / 100;
}

function netAmount(p: PaymentWithFees): number {
  return Math.ceil(Math.max(0, Number(p.amount) - platformFee(p)) * 100) / 100;
}

// GET /api/financials/overview - Get aggregated financial metrics
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

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Execute queries with proper error handling
    const [
      paymentsThisMonth,
      paymentsLastMonth,
      pendingPayouts,
      activeSubscriptions,
      outstandingInvoices,
      invoicesByStatus,
      settledTransactions,
      refundsThisMonth,
      chargebacksThisMonth,
      platformAccount,
      nextScheduledPayout,
      payoutsThisMonth,
      payoutsYTD,
      paymentsYTD,
    ] = await Promise.all([
      // Revenue this month — fetch with fee rates so we can compute net
      db.payment.findMany({
        where: {
          invoice: { organizationId },
          status: "COMPLETED",
          processedAt: { gte: currentMonth },
        },
        select: {
          amount: true,
          transaction: { select: { feeRate: true, feeFixed: true } },
        },
      }),

      // Revenue last month
      db.payment.findMany({
        where: {
          invoice: { organizationId },
          status: "COMPLETED",
          processedAt: { gte: lastMonth, lt: currentMonth },
        },
        select: {
          amount: true,
          transaction: { select: { feeRate: true, feeFixed: true } },
        },
      }),

      // Pending payouts
      db.payout.aggregate({
        where: {
          organizationId,
          status: { in: ["PENDING", "SCHEDULED"] },
        },
        _sum: { net: true },
        _count: true,
      }),

      // Active recurring charges (subscriptions)
      db.recurringCharge.count({
        where: {
          organizationId,
          status: "ACTIVE",
        },
      }),

      // Outstanding invoices
      db.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        },
        _sum: { total: true },
        _count: true,
      }),

      // Invoices by status
      db.invoice.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
        _sum: { total: true },
      }),

      // Settled transactions this month
      db.transaction.aggregate({
        where: {
          organizationId,
          status: "SETTLED",
          settledAt: { gte: currentMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Refunds this month
      db.transaction.aggregate({
        where: {
          organizationId,
          type: "REFUND",
          createdAt: { gte: currentMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Chargebacks this month
      db.transaction.aggregate({
        where: {
          organizationId,
          type: "CHARGEBACK",
          createdAt: { gte: currentMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Adyen platform account status
      db.adyenPlatformAccount.findUnique({
        where: { organizationId },
        select: {
          onboardingStatus: true,
          verificationStatus: true,
          balanceAccountId: true,
        },
      }),

      // Next scheduled payout
      db.payout.findFirst({
        where: {
          organizationId,
          status: "SCHEDULED",
        },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          amount: true,
          net: true,
          scheduledAt: true,
          estimatedArrivalTime: true,
        },
      }),

      // Fees + net from paid payouts this month
      db.payout.aggregate({
        where: { organizationId, status: "PAID", paidAt: { gte: currentMonth } },
        _sum: { fees: true, net: true },
      }),

      // Fees + net from paid payouts YTD
      db.payout.aggregate({
        where: { organizationId, status: "PAID", paidAt: { gte: yearStart } },
        _sum: { fees: true, net: true },
      }),

      // Revenue YTD with fee rates for net computation
      db.payment.findMany({
        where: {
          invoice: { organizationId },
          status: "COMPLETED",
          processedAt: { gte: yearStart },
        },
        select: {
          amount: true,
          transaction: { select: { feeRate: true, feeFixed: true } },
        },
      }),
    ]);

    const isVerified = platformAccount?.onboardingStatus === "VERIFIED";
    const liveBalance =
      isVerified && platformAccount?.balanceAccountId
        ? await getBalanceAccountBalance(platformAccount.balanceAccountId)
        : null;

    // Get revenue by month using Prisma instead of raw SQL
    const paymentsForChart = await db.payment.findMany({
      where: {
        invoice: { organizationId },
        status: "COMPLETED",
        processedAt: { gte: sixMonthsAgo },
      },
      select: {
        amount: true,
        processedAt: true,
        transaction: { select: { feeRate: true, feeFixed: true } },
      },
    });

    // Group payments by month (net after platform fees)
    const monthlyRevenueMap = new Map<string, number>();
    for (const payment of paymentsForChart) {
      if (payment.processedAt) {
        const monthKey = payment.processedAt.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
        const current = monthlyRevenueMap.get(monthKey) || 0;
        monthlyRevenueMap.set(monthKey, current + netAmount(payment));
      }
    }

    // Build a full 6-month series so the chart always shows all months
    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return { month: key.split(" ")[0], revenue: monthlyRevenueMap.get(key) ?? 0 };
    });

    // Get revenue breakdown by category using Prisma
    const lineItemsForBreakdown = await db.lineItem.findMany({
      where: {
        invoice: {
          organizationId,
          status: { in: ["PAID", "PARTIAL"] },
          createdAt: { gte: currentMonth },
        },
      },
      select: {
        total: true,
        programId: true,
        eventId: true,
      },
    });

    // Calculate breakdown
    const breakdownMap = {
      membership: 0,
      events: 0,
      merchandise: 0,
      lessons: 0,
    };

    for (const item of lineItemsForBreakdown) {
      const amount = Number(item.total);
      if (item.programId) {
        breakdownMap.membership += amount;
      } else if (item.eventId) {
        breakdownMap.events += amount;
      } else {
        breakdownMap.merchandise += amount;
      }
    }

    const completeBreakdown = Object.entries(breakdownMap).map(([category, amount]) => ({
      category,
      amount,
    }));

    // Calculate month-over-month change (net after platform fees)
    const currentRevenue = paymentsThisMonth.reduce((sum, p) => sum + netAmount(p), 0);
    const previousRevenue = paymentsLastMonth.reduce((sum, p) => sum + netAmount(p), 0);
    const grossThisMonth = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0);
    const grossYTD = paymentsYTD.reduce((sum, p) => sum + Number(p.amount), 0);
    const netYTDFromPayments = paymentsYTD.reduce((sum, p) => sum + netAmount(p), 0);
    const feesThisMonthFromTxns = paymentsThisMonth.reduce((sum, p) => sum + platformFee(p), 0);
    const feesYTDFromTxns = paymentsYTD.reduce((sum, p) => sum + platformFee(p), 0);
    const revenueChange =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return NextResponse.json({
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        changePercent: revenueChange.toFixed(1),
        transactionCount: paymentsThisMonth.length,
        byMonth: monthlyRevenue,
        breakdown: completeBreakdown,
      },
      payouts: {
        pending: Number(pendingPayouts._sum.net || 0),
        pendingCount: pendingPayouts._count || 0,
        pendingBalance: liveBalance?.pending ?? null,
        liveBalance,
        nextScheduled: nextScheduledPayout
          ? {
              id: nextScheduledPayout.id,
              amount: Number(nextScheduledPayout.net || nextScheduledPayout.amount),
              scheduledAt: nextScheduledPayout.scheduledAt,
              estimatedArrivalTime: nextScheduledPayout.estimatedArrivalTime,
            }
          : null,
        netThisMonth: Number(payoutsThisMonth._sum.net ?? 0),
        netYTD: Number(payoutsYTD._sum.net ?? 0),
      },
      subscriptions: {
        active: activeSubscriptions,
      },
      invoices: {
        outstanding: Number(outstandingInvoices._sum.total || 0),
        outstandingCount: outstandingInvoices._count || 0,
        byStatus: invoicesByStatus.map((s) => ({
          status: s.status,
          count: s._count,
          total: Number(s._sum.total || 0),
        })),
      },
      transactions: {
        settledThisMonth: Number(settledTransactions._sum.amount || 0),
        settledCount: settledTransactions._count || 0,
      },
      refunds: {
        totalThisMonth: Math.abs(Number(refundsThisMonth._sum.amount || 0)),
        count: refundsThisMonth._count || 0,
      },
      chargebacks: {
        totalThisMonth: Math.abs(Number(chargebacksThisMonth._sum.amount || 0)),
        count: chargebacksThisMonth._count || 0,
      },
      adyenStatus: {
        status: platformAccount?.onboardingStatus || "not_onboarded",
        verificationComplete: platformAccount?.onboardingStatus === "VERIFIED",
        hasBalanceAccount: !!platformAccount?.balanceAccountId,
      },
      fees: {
        thisMonth: feesThisMonthFromTxns,
      },
      summary: {
        grossThisMonth,
        feesThisMonth: feesThisMonthFromTxns,
        netThisMonth: currentRevenue,
        grossYTD,
        netYTD: netYTDFromPayments,
        feesYTD: feesYTDFromTxns,
      },
    });
  } catch (error) {
    console.error("Error fetching financial overview:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json({ error: "Failed to fetch financial overview" }, { status: 500 });
  }
}
