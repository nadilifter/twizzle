import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createPaymentSchema = z.object({
  invoiceId: z.string().optional().nullable(),
  userId: z.string().min(1, "Guardian is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.enum(["CARD", "BANK", "CASH", "CHECK"]),
});

// GET /api/payments - List payments/transactions
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const invoiceId = searchParams.get("invoiceId");
    const status = searchParams.get("status");
    const method = searchParams.get("method");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      invoice: { organizationId: session.user.organizationId },
      ...(userId ? { userId } : {}),
      ...(invoiceId && { invoiceId }),
      ...(status && { status: status as "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" }),
      ...(method && { method: method as "CARD" | "BANK" | "CASH" | "CHECK" }),
      ...(startDate &&
        endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              reference: true,
              total: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.payment.count({ where }),
    ]);

    return NextResponse.json({
      data: payments,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

// POST /api/payments - Record a payment
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
    const validatedData = createPaymentSchema.parse(body);

    const guardianUser = await db.user.findUnique({
      where: { id: validatedData.userId },
      select: { id: true },
    });
    if (!guardianUser) {
      return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
    }

    if (validatedData.invoiceId) {
      const invoice = await db.invoice.findFirst({
        where: {
          id: validatedData.invoiceId,
          organizationId: session.user.organizationId,
        },
      });

      if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
    }

    const payment = await db.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: validatedData.invoiceId,
          userId: validatedData.userId,
          amount: validatedData.amount,
          method: validatedData.method,
          status: "COMPLETED",
          processedAt: new Date(),
        },
        include: {
          invoice: true,
        },
      });

      await tx.user.update({
        where: { id: validatedData.userId },
        data: { balance: { decrement: validatedData.amount } },
      });

      if (validatedData.invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: validatedData.invoiceId,
            organizationId: session.user.organizationId,
          },
          include: {
            payments: {
              where: { status: "COMPLETED" },
            },
          },
        });

        if (invoice) {
          const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);

          let newStatus = invoice.status;
          if (totalPaid >= Number(invoice.total)) {
            newStatus = "PAID";
          } else if (totalPaid > 0) {
            newStatus = "PARTIAL";
          }

          if (newStatus !== invoice.status) {
            await tx.invoice.update({
              where: {
                id: validatedData.invoiceId,
                organizationId: session.user.organizationId,
              },
              data: { status: newStatus },
            });
          }
        }
      }

      return created;
    });

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating payment:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
