import { db } from "@/lib/db"

export interface SettlementSummary {
  organizationId: string
  organizationName: string
  period: { start: Date; end: Date }
  grossPayments: number
  refunds: number
  chargebacks: number
  netSettlement: number
  payoutsCompleted: number
  payoutsPending: number
}

export async function getSettlementSummary(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<SettlementSummary> {
  const [org, transactions, payouts] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    db.transaction.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { type: true, amount: true, status: true },
    }),
    db.payout.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { amount: true, fees: true, net: true, status: true },
    }),
  ])

  const grossPayments = transactions
    .filter((t) => t.type === "PAYMENT" && t.status === "SETTLED")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const refunds = transactions
    .filter((t) => t.type === "REFUND")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  const chargebacks = transactions
    .filter((t) => t.type === "CHARGEBACK")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  const payoutsCompleted = payouts
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.net), 0)

  const payoutsPending = payouts
    .filter((p) => p.status === "PENDING" || p.status === "SCHEDULED")
    .reduce((sum, p) => sum + Number(p.net), 0)

  return {
    organizationId,
    organizationName: org?.name || "",
    period: { start: startDate, end: endDate },
    grossPayments,
    refunds,
    chargebacks,
    netSettlement: grossPayments - refunds - chargebacks,
    payoutsCompleted,
    payoutsPending,
  }
}

export interface SuperadminOverview {
  totalGrossVolume: number
  totalRefunds: number
  totalChargebacks: number
  totalPayouts: number
  orgCount: number
  orgsWithNegativeBalance: number
}

export async function getSuperadminOverview(
  startDate: Date,
  endDate: Date
): Promise<SuperadminOverview> {
  const [transactions, payouts, orgCount, negativeBalanceCount] =
    await Promise.all([
      db.transaction.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { type: true, amount: true, status: true },
      }),
      db.payout.aggregate({
        where: {
          status: "PAID",
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { net: true },
      }),
      db.organization.count({ where: { isActive: true } }),
      db.adyenPlatformAccount.count({
        where: { onboardingStatus: "VERIFIED" },
      }),
    ])

  const totalGrossVolume = transactions
    .filter((t) => t.type === "PAYMENT" && t.status === "SETTLED")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalRefunds = transactions
    .filter((t) => t.type === "REFUND")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  const totalChargebacks = transactions
    .filter((t) => t.type === "CHARGEBACK")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  return {
    totalGrossVolume,
    totalRefunds,
    totalChargebacks,
    totalPayouts: Number(payouts._sum.net || 0),
    orgCount,
    orgsWithNegativeBalance: negativeBalanceCount,
  }
}

export interface PayoutHistoryEntry {
  id: string
  amount: number
  fees: number
  net: number
  status: string
  bankAccount: string | null
  scheduledAt: Date | null
  paidAt: Date | null
  createdAt: Date
}

export async function getPayoutHistory(
  organizationId: string,
  limit: number = 20
): Promise<PayoutHistoryEntry[]> {
  const payouts = await db.payout.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      fees: true,
      net: true,
      status: true,
      bankAccount: true,
      scheduledAt: true,
      paidAt: true,
      createdAt: true,
    },
  })

  return payouts.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    fees: Number(p.fees),
    net: Number(p.net),
    status: p.status,
    bankAccount: p.bankAccount,
    scheduledAt: p.scheduledAt,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  }))
}
