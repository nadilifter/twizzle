import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db, getScopedDb } from "@/lib/db"
import { parseDateOnly } from "@/lib/date-utils"
import { z } from "zod"

const createPayoutSchema = z.object({
  reference: z.string().min(1, "Reference is required"),
  amount: z.number().min(0),
  fees: z.number().default(0),
  net: z.number().min(0),
  currency: z.string().default("USD"),
  status: z.enum(["PENDING", "SCHEDULED", "PAID", "FAILED"]),
  bankAccount: z.string().optional(),
  scheduledAt: z.string().optional(),
  paidAt: z.string().optional(),
})

// GET /api/payouts - List payouts with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const scopedDb = getScopedDb(organizationId)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      const createdAtFilter: Record<string, Date> = {}
      if (startDate) {
        const parsed = parseDateOnly(startDate)
        if (parsed) createdAtFilter.gte = parsed
      }
      if (endDate) {
        const parsed = parseDateOnly(endDate)
        if (parsed) {
          // Set to end of day for inclusive filtering
          const endOfDay = new Date(parsed)
          endOfDay.setUTCHours(23, 59, 59, 999)
          createdAtFilter.lte = endOfDay
        }
      }
      if (Object.keys(createdAtFilter).length > 0) {
        where.createdAt = createdAtFilter
      }
    }

    const [payouts, total] = await Promise.all([
      scopedDb.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.payout.count({ where }),
    ])

    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)

    // aggregate is not handled by getScopedDb -- scope manually
    const [pendingStats, paidYTD, nextPayout] = await Promise.all([
      db.payout.aggregate({
        where: {
          organizationId,
          status: { in: ["PENDING", "SCHEDULED"] },
        },
        _sum: { net: true },
        _count: true,
      }),
      db.payout.aggregate({
        where: {
          organizationId,
          status: "PAID",
          paidAt: { gte: yearStart },
        },
        _sum: { net: true },
      }),
      scopedDb.payout.findFirst({
        where: { status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
      }),
    ])

    const unsettledTransactions = await db.transaction.aggregate({
      where: {
        organizationId,
        status: { in: ["AUTHORISED", "CAPTURED"] },
        type: "PAYMENT",
      },
      _sum: { amount: true },
      _count: true,
    })

    return NextResponse.json({
      data: payouts,
      total,
      limit,
      offset,
      stats: {
        pendingAmount: pendingStats._sum.net || 0,
        pendingCount: pendingStats._count || 0,
        paidYTD: paidYTD._sum.net || 0,
        nextPayout: nextPayout,
        unsettledAmount: unsettledTransactions._sum.amount || 0,
        unsettledCount: unsettledTransactions._count || 0,
      },
    })
  } catch (error) {
    console.error("Error fetching payouts:", error)
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    )
  }
}

// POST /api/payouts - Create payout (typically from webhook or manual)
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const scopedDb = getScopedDb(session.user.organizationId)

    const body = await request.json()
    const validatedData = createPayoutSchema.parse(body)

    const existing = await scopedDb.payout.findFirst({
      where: { reference: validatedData.reference },
    })

    if (existing) {
      return NextResponse.json(existing)
    }

    const payout = await scopedDb.payout.create({
      data: {
        organizationId: session.user.organizationId,
        reference: validatedData.reference,
        amount: validatedData.amount,
        fees: validatedData.fees,
        net: validatedData.net,
        currency: validatedData.currency,
        status: validatedData.status,
        bankAccount: validatedData.bankAccount,
        scheduledAt: validatedData.scheduledAt
          ? new Date(validatedData.scheduledAt)
          : null,
        paidAt: validatedData.paidAt
          ? new Date(validatedData.paidAt)
          : null,
      },
    })

    return NextResponse.json(payout)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating payout:", error)
    return NextResponse.json(
      { error: "Failed to create payout" },
      { status: 500 }
    )
  }
}
