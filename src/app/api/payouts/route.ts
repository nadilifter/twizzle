import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

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
});

// GET /api/payouts - List payouts with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.createdAt = {
        gte: new Date(startDate),
      };
    } else if (endDate) {
      where.createdAt = {
        lte: new Date(endDate),
      };
    }

    const [payouts, total] = await Promise.all([
      db.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.payout.count({ where }),
    ]);

    // Calculate stats
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    const [pendingStats, paidYTD, nextPayout] = await Promise.all([
      // Pending payouts
      db.payout.aggregate({
        where: {
          organizationId: session.user.organizationId,
          status: { in: ["PENDING", "SCHEDULED"] },
        },
        _sum: {
          net: true,
        },
        _count: true,
      }),
      // Paid this year
      db.payout.aggregate({
        where: {
          organizationId: session.user.organizationId,
          status: "PAID",
          paidAt: {
            gte: yearStart,
          },
        },
        _sum: {
          net: true,
        },
      }),
      // Next scheduled payout
      db.payout.findFirst({
        where: {
          organizationId: session.user.organizationId,
          status: "SCHEDULED",
        },
        orderBy: { scheduledAt: "asc" },
      }),
    ]);

    // Calculate pending balance from unsettled transactions
    const unsettledTransactions = await db.transaction.aggregate({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ["AUTHORISED", "CAPTURED"] },
        type: "PAYMENT",
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

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
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

// POST /api/payouts - Create payout (typically from webhook or manual)
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createPayoutSchema.parse(body);

    // Check if payout already exists (idempotency)
    const existing = await db.payout.findUnique({
      where: { reference: validatedData.reference },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const payout = await db.payout.create({
      data: {
        organizationId: session.user.organizationId,
        reference: validatedData.reference,
        amount: validatedData.amount,
        fees: validatedData.fees,
        net: validatedData.net,
        currency: validatedData.currency,
        status: validatedData.status,
        bankAccount: validatedData.bankAccount,
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        paidAt: validatedData.paidAt ? new Date(validatedData.paidAt) : null,
      },
    });

    return NextResponse.json(payout);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating payout:", error);
    return NextResponse.json(
      { error: "Failed to create payout" },
      { status: 500 }
    );
  }
}
