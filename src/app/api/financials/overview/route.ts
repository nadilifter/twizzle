import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

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

    // Execute queries with proper error handling
    const [
      revenueThisMonth,
      revenueLastMonth,
      pendingPayouts,
      activeSubscriptions,
      outstandingInvoices,
      invoicesByStatus,
      settledTransactions,
      refundsThisMonth,
      chargebacksThisMonth,
      platformAccount,
      nextScheduledPayout,
    ] = await Promise.all([
      // Revenue this month (from completed payments)
      db.payment.aggregate({
        where: {
          invoice: { organizationId },
          status: "COMPLETED",
          processedAt: { gte: currentMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Revenue last month
      db.payment.aggregate({
        where: {
          invoice: { organizationId },
          status: "COMPLETED",
          processedAt: {
            gte: lastMonth,
            lt: currentMonth,
          },
        },
        _sum: { amount: true },
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
    ]);

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
      },
    });

    // Group payments by month
    const monthlyRevenueMap = new Map<string, number>();
    for (const payment of paymentsForChart) {
      if (payment.processedAt) {
        const monthKey = payment.processedAt.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
        const current = monthlyRevenueMap.get(monthKey) || 0;
        monthlyRevenueMap.set(monthKey, current + Number(payment.amount));
      }
    }

    // Convert to array and sort by date
    const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
      .map(([month, revenue]) => ({ month: month.split(" ")[0], revenue }))
      .slice(-6); // Last 6 months

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

    // Calculate month-over-month change
    const currentRevenue = Number(revenueThisMonth._sum.amount || 0);
    const previousRevenue = Number(revenueLastMonth._sum.amount || 0);
    const revenueChange =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return NextResponse.json({
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        changePercent: revenueChange.toFixed(1),
        transactionCount: revenueThisMonth._count || 0,
        byMonth: monthlyRevenue,
        breakdown: completeBreakdown,
      },
      payouts: {
        pending: Number(pendingPayouts._sum.net || 0),
        pendingCount: pendingPayouts._count || 0,
        nextScheduled: nextScheduledPayout
          ? {
              id: nextScheduledPayout.id,
              amount: Number(nextScheduledPayout.net || nextScheduledPayout.amount),
              scheduledAt: nextScheduledPayout.scheduledAt,
              estimatedArrivalTime: nextScheduledPayout.estimatedArrivalTime,
            }
          : null,
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
    });
  } catch (error) {
    console.error("Error fetching financial overview:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json({ error: "Failed to fetch financial overview" }, { status: 500 });
  }
}
