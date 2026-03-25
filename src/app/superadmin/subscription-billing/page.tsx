import { db } from "@/lib/db"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  AlertTriangle,
  Clock,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  ShieldCheck,
  RotateCcw,
} from "lucide-react"
import { InvoiceActions } from "./invoice-actions"

export default async function SubscriptionBillingPage() {
  const now = new Date()
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12))
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12))
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Build 12-month lookback window for trend data
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 12))

  const [
    invoices,
    allPaidResult,
    allInvoiceCount,
    totalFailedCount,
    gracePeriodOrgs,
    paidThisMonth,
    paidLastMonth,
    activeSubscriptions,
    activeSubsWithPlan,
    revenueByPlanRaw,
    monthlyInvoices,
    recoveredInvoiceCount,
    recentChurns,
  ] = await Promise.all([
    // Recent invoices for table
    db.subscriptionInvoice.findMany({
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        plan: { select: { name: true } },
        paymentAttempts: {
          orderBy: { attemptNumber: "asc" },
          include: {
            paymentMethod: { select: { brand: true, lastFour: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),

    // All-time paid revenue
    db.subscriptionInvoice.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: true,
    }),

    // Total invoice count (non-void) for collection rate
    db.subscriptionInvoice.count({
      where: { status: { not: "VOID" } },
    }),

    // Failed invoice count
    db.subscriptionInvoice.count({
      where: { status: "FAILED" },
    }),

    // Grace period orgs
    db.organization.findMany({
      where: {
        scheduledDeactivationDate: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        scheduledDeactivationDate: true,
      },
      orderBy: { scheduledDeactivationDate: "asc" },
    }),

    // This month's paid revenue
    db.subscriptionInvoice.aggregate({
      where: {
        status: "PAID",
        periodStart: { gte: firstOfMonth },
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Last month's paid revenue (for MoM comparison)
    db.subscriptionInvoice.aggregate({
      where: {
        status: "PAID",
        periodStart: { gte: firstOfLastMonth, lt: firstOfMonth },
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Active subscription count
    db.organizationSubscription.count({
      where: { status: "ACTIVE" },
    }),

    // Active subscriptions with plan pricing for MRR calculation
    db.organizationSubscription.findMany({
      where: { status: "ACTIVE" },
      include: {
        plan: { select: { monthlyPrice: true, yearlyPrice: true, name: true } },
      },
    }),

    // Revenue by plan: group paid invoices by planId
    db.subscriptionInvoice.groupBy({
      by: ["planId"],
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: true,
    }),

    // Monthly invoice data for trend (last 12 months)
    db.subscriptionInvoice.findMany({
      where: {
        periodStart: { gte: twelveMonthsAgo },
        status: { not: "VOID" },
      },
      select: {
        periodStart: true,
        amount: true,
        status: true,
      },
    }),

    // Dunning recovery: invoices that have both FAILED attempts and a PAID status
    db.subscriptionInvoice.count({
      where: {
        status: "PAID",
        paymentAttempts: {
          some: { status: "FAILED" },
        },
      },
    }),

    // Recent churns (deactivated for non-payment in last 30 days)
    db.organization.findMany({
      where: {
        isActive: false,
        deactivationReason: "Non-payment",
        deactivatedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        deactivatedAt: true,
        subscription: {
          select: { plan: { select: { monthlyPrice: true, name: true } } },
        },
      },
      orderBy: { deactivatedAt: "desc" },
    }),
  ])

  // ── Computed metrics ──

  // MRR: sum of monthly-equivalent plan prices for all active subscriptions
  const mrr = activeSubsWithPlan.reduce((sum, sub) => {
    const price =
      sub.billingCycle === "YEARLY"
        ? Number(sub.plan.yearlyPrice ?? sub.plan.monthlyPrice) / 12
        : Number(sub.plan.monthlyPrice)
    return sum + price
  }, 0)
  const arr = mrr * 12

  // ARPU
  const arpu = activeSubscriptions > 0 ? mrr / activeSubscriptions : 0

  // Collection rate
  const paidCount = allPaidResult._count
  const collectionRate =
    allInvoiceCount > 0 ? ((paidCount / allInvoiceCount) * 100) : 0

  // Dunning recovery rate: recovered / (recovered + still failed)
  const dunningTotal = recoveredInvoiceCount + totalFailedCount
  const dunningRecoveryRate =
    dunningTotal > 0 ? ((recoveredInvoiceCount / dunningTotal) * 100) : 0

  // MoM revenue change
  const thisMonthRevenue = Number(paidThisMonth._sum.amount ?? 0)
  const lastMonthRevenue = Number(paidLastMonth._sum.amount ?? 0)
  const momChange =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0

  // Revenue by plan with names
  const planIds = revenueByPlanRaw.map((r) => r.planId)
  const plans = await db.subscriptionPlan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, name: true, monthlyPrice: true },
  })
  const planMap = new Map(plans.map((p) => [p.id, p]))

  const activeCountByPlan = activeSubsWithPlan.reduce<Record<string, number>>(
    (acc, sub) => {
      acc[sub.planId] = (acc[sub.planId] || 0) + 1
      return acc
    },
    {}
  )

  const revenueByPlan = revenueByPlanRaw
    .map((r) => ({
      planId: r.planId,
      planName: planMap.get(r.planId)?.name ?? "Unknown",
      totalRevenue: Number(r._sum.amount ?? 0),
      invoiceCount: r._count,
      activeSubscribers: activeCountByPlan[r.planId] ?? 0,
      mrrContribution:
        (activeCountByPlan[r.planId] ?? 0) *
        Number(planMap.get(r.planId)?.monthlyPrice ?? 0),
    }))
    .sort((a, b) => b.mrrContribution - a.mrrContribution)

  // Monthly trend: aggregate by month
  const monthlyTrend = buildMonthlyTrend(monthlyInvoices, now)

  // Churned MRR
  const churnedMRR = recentChurns.reduce((sum, org) => {
    return sum + Number(org.subscription?.plan?.monthlyPrice ?? 0)
  }, 0)

  const totalRevenue = Number(allPaidResult._sum.amount ?? 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)

  const formatPercent = (value: number) =>
    `${value >= 0 ? "" : ""}${value.toFixed(1)}%`

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "PAID": return "default"
      case "FAILED": return "destructive"
      case "PROCESSING": return "outline"
      case "PENDING": return "secondary"
      case "VOID": return "secondary"
      default: return "outline"
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Subscription Billing</h1>
        <p className="text-muted-foreground">
          SaaS revenue metrics, collection health, and invoice management
        </p>
      </div>

      {/* Row 1: Core Revenue Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mrr)}</div>
            <p className="text-xs text-muted-foreground">
              ARR: {formatCurrency(arr)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(thisMonthRevenue)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {lastMonthRevenue > 0 ? (
                <>
                  {momChange >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className={momChange >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatPercent(momChange)}
                  </span>
                  {" vs last month"}
                </>
              ) : (
                `${paidThisMonth._count} invoices collected`
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              ARPU: {formatCurrency(arpu)}/mo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Revenue</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {paidCount} invoices collected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Health & Risk Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${collectionRate >= 95 ? "text-green-600" : collectionRate >= 85 ? "text-amber-600" : "text-red-600"}`}>
              {formatPercent(collectionRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              {paidCount} paid of {allInvoiceCount} invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dunning Recovery</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dunningRecoveryRate >= 70 ? "text-green-600" : dunningRecoveryRate >= 40 ? "text-amber-600" : "text-red-600"}`}>
              {dunningTotal > 0 ? formatPercent(dunningRecoveryRate) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {recoveredInvoiceCount} recovered of {dunningTotal} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed / At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalFailedCount}</div>
            <p className="text-xs text-muted-foreground">
              {gracePeriodOrgs.length} org{gracePeriodOrgs.length !== 1 ? "s" : ""} in grace period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churned MRR (30d)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${churnedMRR > 0 ? "text-red-600" : ""}`}>
              {churnedMRR > 0 ? `-${formatCurrency(churnedMRR)}` : formatCurrency(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {recentChurns.length} org{recentChurns.length !== 1 ? "s" : ""} deactivated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Plan + Monthly Trend side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <CardTitle>Revenue by Plan</CardTitle>
            </div>
            <CardDescription>
              MRR contribution and lifetime revenue per subscription plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No revenue data yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Subscribers</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">% of MRR</TableHead>
                    <TableHead className="text-right">Lifetime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByPlan.map((plan) => (
                    <TableRow key={plan.planId}>
                      <TableCell className="font-medium">{plan.planName}</TableCell>
                      <TableCell className="text-right">{plan.activeSubscribers}</TableCell>
                      <TableCell className="text-right">{formatCurrency(plan.mrrContribution)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {mrr > 0 ? formatPercent((plan.mrrContribution / mrr) * 100) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(plan.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
                  {revenueByPlan.length > 1 && (
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{activeSubscriptions}</TableCell>
                      <TableCell className="text-right">{formatCurrency(mrr)}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                      <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Monthly Revenue Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Monthly Revenue Trend</CardTitle>
            </div>
            <CardDescription>
              Collected vs failed revenue over the last 12 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No billing history yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyTrend.map((m) => (
                    <TableRow key={m.label}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(m.collected)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {m.failed > 0 ? formatCurrency(m.failed) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            m.rate >= 95
                              ? "text-green-600"
                              : m.rate >= 85
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          {m.total > 0 ? formatPercent(m.rate) : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grace Period Organizations */}
      {gracePeriodOrgs.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <CardTitle>Organizations in Grace Period</CardTitle>
            </div>
            <CardDescription>
              Failed payments — will be deactivated unless payment is received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gracePeriodOrgs.map((org) => {
                const daysRemaining = Math.ceil(
                  (new Date(org.scheduledDeactivationDate!).getTime() - now.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
                return (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <Link
                        href={`/superadmin/organizations/${org.slug}`}
                        className="font-medium hover:underline"
                      >
                        {org.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        Deactivation:{" "}
                        {new Date(org.scheduledDeactivationDate!).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={daysRemaining <= 7 ? "destructive" : "secondary"}>
                        {Math.max(daysRemaining, 0)} days remaining
                      </Badge>
                      <Link
                        href={`/superadmin/organizations/${org.slug}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Churns */}
      {recentChurns.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <CardTitle>Recent Churns (Last 30 Days)</CardTitle>
            </div>
            <CardDescription>
              Organizations deactivated due to non-payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentChurns.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <Link
                      href={`/superadmin/organizations/${org.slug}`}
                      className="font-medium hover:underline"
                    >
                      {org.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {org.subscription?.plan?.name ?? "Unknown plan"} •
                      Deactivated {org.deactivatedAt?.toLocaleDateString() ?? "N/A"}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-red-600">
                    -{formatCurrency(Number(org.subscription?.plan?.monthlyPrice ?? 0))}/mo
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Recent Invoices</CardTitle>
          </div>
          <CardDescription>Subscription invoices across all organizations</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No subscription invoices yet. Invoices will appear here after the first billing cycle.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment Attempts</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">{invoice.reference}</TableCell>
                    <TableCell>
                      <Link
                        href={`/superadmin/organizations/${invoice.organization.slug}`}
                        className="text-primary hover:underline"
                      >
                        {invoice.organization.name}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.plan.name}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(invoice.periodStart).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          getStatusVariant(invoice.status) as
                            | "default"
                            | "destructive"
                            | "secondary"
                            | "outline"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(invoice.amount))}
                    </TableCell>
                    <TableCell>
                      {invoice.paymentAttempts.length === 0 ? (
                        <span className="text-sm text-muted-foreground">--</span>
                      ) : (
                        <div className="space-y-1">
                          {invoice.paymentAttempts.map((attempt) => (
                            <div key={attempt.id} className="flex items-center gap-2 text-xs">
                              <span
                                className={
                                  attempt.status === "SUCCESS"
                                    ? "text-green-600 font-medium"
                                    : "text-destructive"
                                }
                              >
                                #{attempt.attemptNumber}{" "}
                                {attempt.status === "SUCCESS" ? "Paid" : "Failed"}
                              </span>
                              <span className="text-muted-foreground">
                                {attempt.paymentMethod.brand ?? "card"} ••
                                {attempt.paymentMethod.lastFour}
                              </span>
                              {attempt.failureReason && (
                                <span
                                  className="text-muted-foreground truncate max-w-[120px]"
                                  title={attempt.failureReason}
                                >
                                  ({attempt.failureReason})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <InvoiceActions
                        invoiceId={invoice.id}
                        reference={invoice.reference}
                        status={invoice.status}
                        amount={Number(invoice.amount)}
                        orgName={invoice.organization.name}
                        notes={invoice.notes}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Aggregate invoice records into per-month buckets for a 12-month trend view.
 * Most recent month first.
 */
function buildMonthlyTrend(
  invoices: { periodStart: Date; amount: unknown; status: string }[],
  now: Date
) {
  const buckets = new Map<string, { collected: number; failed: number; total: number }>()

  // Pre-populate the last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    buckets.set(key, { collected: 0, failed: 0, total: 0 })
  }

  for (const inv of invoices) {
    const d = new Date(inv.periodStart)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    const bucket = buckets.get(key)
    if (!bucket) continue

    const amount = Number(inv.amount)
    bucket.total += amount

    if (inv.status === "PAID") {
      bucket.collected += amount
    } else if (inv.status === "FAILED") {
      bucket.failed += amount
    }
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, data]) => {
      const [year, month] = key.split("-")
      const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1))
      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
        ...data,
        rate: data.total > 0 ? (data.collected / data.total) * 100 : 0,
      }
    })
}
