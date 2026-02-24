import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createTransactionSchema = z.object({
  pspReference: z.string().min(1, "PSP reference is required"),
  merchantRef: z.string().optional(),
  type: z.enum(["PAYMENT", "REFUND", "CHARGEBACK", "CAPTURE", "CANCEL"]),
  amount: z.number().min(0),
  currency: z.string().default("USD"),
  status: z.enum(["AUTHORISED", "CAPTURED", "SETTLED", "REFUSED", "CANCELLED", "ERROR", "PENDING"]),
  method: z.string().optional(),
  description: z.string().optional(),
  paymentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// GET /api/transactions - List transactions with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const method = searchParams.get("method");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (search) {
      where.OR = [
        { pspReference: { contains: search, mode: "insensitive" } },
        { merchantRef: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (method) {
      where.method = method;
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

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          payment: {
            select: {
              id: true,
              amount: true,
              invoiceId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.transaction.count({ where }),
    ]);

    // Calculate summary stats
    const stats = await db.transaction.aggregate({
      where: {
        organizationId: session.user.organizationId,
        status: "SETTLED",
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // This month
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    return NextResponse.json({
      data: transactions,
      total,
      limit,
      offset,
      stats: {
        settledThisMonth: stats._sum.amount || 0,
        transactionCount: stats._count || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create transaction (typically from webhook)
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
    const validatedData = createTransactionSchema.parse(body);

    // Check if transaction already exists (idempotency)
    const existing = await db.transaction.findUnique({
      where: { pspReference: validatedData.pspReference },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const transaction = await db.transaction.create({
      data: {
        organizationId: session.user.organizationId,
        pspReference: validatedData.pspReference,
        merchantRef: validatedData.merchantRef,
        type: validatedData.type,
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: validatedData.status,
        method: validatedData.method,
        description: validatedData.description,
        paymentId: validatedData.paymentId,
        metadata: validatedData.metadata,
        settledAt: validatedData.status === "SETTLED" ? new Date() : null,
      },
      include: {
        payment: true,
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
