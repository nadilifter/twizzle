import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

type Granularity = "day" | "month" | "year"

// GET /api/superadmin/revenue - Get platform revenue metrics
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const granularity = (searchParams.get("granularity") || "month") as Granularity
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    // Default date range: last 12 months
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const startDate = startDateParam ? new Date(startDateParam) : defaultStart
    const endDate = endDateParam ? new Date(endDateParam) : now

    // Execute all queries in parallel
    const [
      activeSubscriptions,
      allPlans,
      settledTransactions,
      transactionsByOrg,
      subscriptionHistory,
    ] = await Promise.all([
      // Get all active subscriptions with their plans and organizations
      db.organizationSubscription.findMany({
        where: {
          status: { in: ["ACTIVE", "TRIALING"] },
        },
        include: {
          plan: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),

      // Get all subscription plans for reference
      db.subscriptionPlan.findMany({
        where: { isActive: true },
      }),

      // Get settled transactions in the date range
      db.transaction.findMany({
        where: {
          status: "SETTLED",
          settledAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          organization: {
            include: {
              subscription: {
                include: { plan: true },
              },
            },
          },
        },
        orderBy: { settledAt: "asc" },
      }),

      // Get transaction totals grouped by organization
      db.transaction.groupBy({
        by: ["organizationId"],
        where: {
          status: "SETTLED",
          settledAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Get subscription creation history for trend analysis
      db.organizationSubscription.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          plan: true,
          organization: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ])

    // Calculate MRR (Monthly Recurring Revenue)
    let mrr = 0
    const subscriptionsByPlan: Record<string, { count: number; revenue: number; planName: string }> = {}

    for (const sub of activeSubscriptions) {
      const monthlyValue = sub.billingCycle === "YEARLY"
        ? Number(sub.plan.yearlyPrice || sub.plan.monthlyPrice) / 12
        : Number(sub.plan.monthlyPrice)
      
      mrr += monthlyValue

      // Track by plan
      if (!subscriptionsByPlan[sub.planId]) {
        subscriptionsByPlan[sub.planId] = {
          count: 0,
          revenue: 0,
          planName: sub.plan.name,
        }
      }
      subscriptionsByPlan[sub.planId].count++
      subscriptionsByPlan[sub.planId].revenue += monthlyValue
    }

    const arr = mrr * 12

    // Calculate transaction fee revenue
    let totalTransactionFeeRevenue = 0
    const feesByOrg: Record<string, { 
      orgId: string
      orgName: string
      transactionVolume: number
      feeRevenue: number
      transactionCount: number
      planName: string
    }> = {}

    for (const txn of settledTransactions) {
      const org = txn.organization
      const plan = org?.subscription?.plan
      
      if (!plan) continue

      const amount = Number(txn.amount)
      const percentageFee = amount * Number(plan.transactionFee)
      const perTransactionFee = Number(plan.perTransactionFee)
      const totalFee = percentageFee + perTransactionFee

      totalTransactionFeeRevenue += totalFee

      // Track by organization
      if (!feesByOrg[txn.organizationId]) {
        feesByOrg[txn.organizationId] = {
          orgId: txn.organizationId,
          orgName: org?.name || "Unknown",
          transactionVolume: 0,
          feeRevenue: 0,
          transactionCount: 0,
          planName: plan.name,
        }
      }
      feesByOrg[txn.organizationId].transactionVolume += amount
      feesByOrg[txn.organizationId].feeRevenue += totalFee
      feesByOrg[txn.organizationId].transactionCount++
    }

    // Build revenue by organization combining subscription + fees
    const revenueByOrg: Array<{
      organizationId: string
      organizationName: string
      subscriptionRevenue: number
      transactionFeeRevenue: number
      totalRevenue: number
      planName: string
      transactionCount: number
      transactionVolume: number
    }> = []

    // Add subscription revenue
    for (const sub of activeSubscriptions) {
      const monthlyValue = sub.billingCycle === "YEARLY"
        ? Number(sub.plan.yearlyPrice || sub.plan.monthlyPrice) / 12
        : Number(sub.plan.monthlyPrice)

      const orgFees = feesByOrg[sub.organizationId]

      revenueByOrg.push({
        organizationId: sub.organizationId,
        organizationName: sub.organization.name,
        subscriptionRevenue: monthlyValue,
        transactionFeeRevenue: orgFees?.feeRevenue || 0,
        totalRevenue: monthlyValue + (orgFees?.feeRevenue || 0),
        planName: sub.plan.name,
        transactionCount: orgFees?.transactionCount || 0,
        transactionVolume: orgFees?.transactionVolume || 0,
      })
    }

    // Sort by total revenue descending
    revenueByOrg.sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Build time series data based on granularity
    const revenueOverTime = buildTimeSeriesData(
      settledTransactions,
      subscriptionHistory,
      activeSubscriptions,
      granularity,
      startDate,
      endDate
    )

    // Calculate ARPU (Average Revenue Per User)
    const activePayingCustomers = activeSubscriptions.filter(
      sub => Number(sub.plan.monthlyPrice) > 0
    ).length
    const arpu = activePayingCustomers > 0 
      ? (mrr + totalTransactionFeeRevenue) / activePayingCustomers 
      : 0

    // Plan distribution for pie chart
    const planDistribution = Object.entries(subscriptionsByPlan).map(([planId, data]) => ({
      planId,
      planName: data.planName,
      count: data.count,
      revenue: data.revenue,
    }))

    // Revenue by source for pie chart
    const revenueBySource = [
      { source: "Subscriptions", amount: mrr },
      { source: "Transaction Fees", amount: totalTransactionFeeRevenue },
    ]

    // Calculate period-over-period comparison
    const periodLength = endDate.getTime() - startDate.getTime()
    const previousStart = new Date(startDate.getTime() - periodLength)
    const previousEnd = new Date(startDate.getTime() - 1)

    const previousTransactions = await db.transaction.aggregate({
      where: {
        status: "SETTLED",
        settledAt: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
      _sum: { amount: true },
      _count: true,
    })

    // Calculate previous period fee revenue (simplified estimate)
    const avgFeeRate = settledTransactions.length > 0
      ? totalTransactionFeeRevenue / settledTransactions.reduce((sum, t) => sum + Number(t.amount), 0)
      : 0
    const previousFeeRevenue = Number(previousTransactions._sum.amount || 0) * avgFeeRate

    const currentTotalRevenue = mrr + totalTransactionFeeRevenue
    const previousTotalRevenue = mrr + previousFeeRevenue // MRR assumed stable for simplicity
    const revenueGrowth = previousTotalRevenue > 0
      ? ((currentTotalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100
      : 0

    return NextResponse.json({
      // KPI metrics
      kpis: {
        mrr,
        arr,
        totalTransactionFeeRevenue,
        totalPlatformRevenue: mrr + totalTransactionFeeRevenue,
        activePayingCustomers,
        arpu,
        revenueGrowth: Number(revenueGrowth.toFixed(1)),
        totalTransactionVolume: settledTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
        transactionCount: settledTransactions.length,
      },

      // Chart data
      revenueOverTime,
      revenueBySource,
      planDistribution,
      revenueByOrg: revenueByOrg.slice(0, 20), // Top 20 organizations

      // Summary counts
      summary: {
        totalOrganizations: activeSubscriptions.length,
        totalPlans: allPlans.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          granularity,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching revenue data:", error)
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    )
  }
}

// Helper function to build time series data
function buildTimeSeriesData(
  transactions: Array<{ settledAt: Date | null; amount: any; organizationId: string; organization: any }>,
  subscriptionHistory: Array<{ createdAt: Date; plan: any }>,
  activeSubscriptions: Array<{ billingCycle: string; plan: any }>,
  granularity: Granularity,
  startDate: Date,
  endDate: Date
): Array<{ period: string; subscriptionRevenue: number; transactionFeeRevenue: number; totalRevenue: number }> {
  const result: Map<string, { subscriptionRevenue: number; transactionFeeRevenue: number }> = new Map()

  // Generate all periods in range
  const periods = generatePeriods(startDate, endDate, granularity)
  for (const period of periods) {
    result.set(period, { subscriptionRevenue: 0, transactionFeeRevenue: 0 })
  }

  // Calculate current MRR for subscription revenue allocation
  let currentMrr = 0
  for (const sub of activeSubscriptions) {
    const monthlyValue = sub.billingCycle === "YEARLY"
      ? Number(sub.plan.yearlyPrice || sub.plan.monthlyPrice) / 12
      : Number(sub.plan.monthlyPrice)
    currentMrr += monthlyValue
  }

  // Distribute MRR across periods (simplified - assumes constant MRR)
  for (const period of periods) {
    const data = result.get(period)!
    if (granularity === "day") {
      data.subscriptionRevenue = currentMrr / 30 // Daily portion
    } else if (granularity === "month") {
      data.subscriptionRevenue = currentMrr
    } else {
      data.subscriptionRevenue = currentMrr * 12 // Yearly
    }
  }

  // Add transaction fee revenue
  for (const txn of transactions) {
    if (!txn.settledAt) continue

    const period = formatPeriod(txn.settledAt, granularity)
    const data = result.get(period)
    if (!data) continue

    const plan = txn.organization?.subscription?.plan
    if (!plan) continue

    const amount = Number(txn.amount)
    const fee = amount * Number(plan.transactionFee) + Number(plan.perTransactionFee)
    data.transactionFeeRevenue += fee
  }

  return Array.from(result.entries()).map(([period, data]) => ({
    period,
    subscriptionRevenue: Number(data.subscriptionRevenue.toFixed(2)),
    transactionFeeRevenue: Number(data.transactionFeeRevenue.toFixed(2)),
    totalRevenue: Number((data.subscriptionRevenue + data.transactionFeeRevenue).toFixed(2)),
  }))
}

function generatePeriods(startDate: Date, endDate: Date, granularity: Granularity): string[] {
  const periods: string[] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    periods.push(formatPeriod(current, granularity))

    if (granularity === "day") {
      current.setDate(current.getDate() + 1)
    } else if (granularity === "month") {
      current.setMonth(current.getMonth() + 1)
    } else {
      current.setFullYear(current.getFullYear() + 1)
    }
  }

  return periods
}

function formatPeriod(date: Date, granularity: Granularity): string {
  if (granularity === "day") {
    return date.toISOString().split("T")[0] // YYYY-MM-DD
  } else if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` // YYYY-MM
  } else {
    return String(date.getFullYear()) // YYYY
  }
}
