import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createPaymentSchema = z.object({
  invoiceId: z.string().optional().nullable(),
  familyId: z.string().min(1, "Family is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.enum(["CARD", "BANK", "CASH", "CHECK"]),
  transactionId: z.string().optional(),
});

// GET /api/payments - List payments/transactions
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get("familyId");
    const invoiceId = searchParams.get("invoiceId");
    const status = searchParams.get("status");
    const method = searchParams.get("method");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      family: {
        organizationId: session.user.organizationId,
      },
      ...(familyId && { familyId }),
      ...(invoiceId && { invoiceId }),
      ...(status && { status: status as "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" }),
      ...(method && { method: method as "CARD" | "BANK" | "CASH" | "CHECK" }),
      ...(startDate && endDate && {
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
          family: {
            select: {
              id: true,
              name: true,
              email: true,
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
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
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

    // Verify family
    const family = await db.family.findFirst({
      where: {
        id: validatedData.familyId,
        organizationId: session.user.organizationId,
      },
    });

    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify invoice if provided
    if (validatedData.invoiceId) {
      const invoice = await db.invoice.findFirst({
        where: {
          id: validatedData.invoiceId,
          organizationId: session.user.organizationId,
          familyId: validatedData.familyId,
        },
      });

      if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
    }

    // Create payment (marked as PENDING by default - would be COMPLETED after processing)
    const payment = await db.payment.create({
      data: {
        invoiceId: validatedData.invoiceId,
        familyId: validatedData.familyId,
        amount: validatedData.amount,
        method: validatedData.method,
        status: "COMPLETED", // For manual payments, mark as completed
        transactionId: validatedData.transactionId,
        processedAt: new Date(),
      },
      include: {
        invoice: true,
        family: true,
      },
    });

    // Update family balance
    await db.family.update({
      where: { id: validatedData.familyId },
      data: {
        balance: {
          decrement: validatedData.amount,
        },
      },
    });

    // Update invoice status if fully paid
    if (validatedData.invoiceId) {
      const invoice = await db.invoice.findUnique({
        where: { id: validatedData.invoiceId },
        include: {
          payments: {
            where: { status: "COMPLETED" },
          },
        },
      });

      if (invoice) {
        const totalPaid = invoice.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        );

        let newStatus = invoice.status;
        if (totalPaid >= Number(invoice.total)) {
          newStatus = "PAID";
        } else if (totalPaid > 0) {
          newStatus = "PARTIAL";
        }

        if (newStatus !== invoice.status) {
          await db.invoice.update({
            where: { id: validatedData.invoiceId },
            data: { status: newStatus },
          });
        }
      }
    }

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
