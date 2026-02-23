import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateInvoiceSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED", "PARTIAL"]).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/invoices/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await db.invoice.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        family: {
          include: {
            guardians: {
              include: {
                athlete: {
                  select: { id: true, name: true },
                },
              },
            },
            paymentMethods: true,
          },
        },
        lineItems: {
          include: {
            program: true,
            event: true,
            athlete: true,
            discount: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Calculate amounts
    const paidAmount = invoice.payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({
      ...invoice,
      paidAmount,
      balanceDue: Number(invoice.total) - paidAmount,
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

// PATCH /api/invoices/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateInvoiceSchema.parse(body);

    const existing = await db.invoice.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Handle status changes that affect family balance
    const oldStatus = existing.status;
    const newStatus = validatedData.status;

    const invoice = await db.invoice.update({
      where: { id },
      data: {
        ...validatedData,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
      },
      include: {
        family: true,
        lineItems: true,
        payments: true,
      },
    });

    // Update family balance based on status change
    if (newStatus && oldStatus !== newStatus) {
      const amount = Number(invoice.total);

      // If changing to SENT from DRAFT, add to balance
      if (oldStatus === "DRAFT" && newStatus === "SENT") {
        await db.family.update({
          where: { id: invoice.familyId },
          data: { balance: { increment: amount } },
        });
      }

      // If cancelling a sent invoice, remove from balance
      if ((oldStatus === "SENT" || oldStatus === "OVERDUE") && newStatus === "CANCELLED") {
        await db.family.update({
          where: { id: invoice.familyId },
          data: { balance: { decrement: amount } },
        });
      }
    }

    return NextResponse.json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

// DELETE /api/invoices/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.invoice.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        payments: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Prevent deletion of invoices with payments
    if (existing.payments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete invoice with payments. Cancel it instead." },
        { status: 400 }
      );
    }

    // Only allow deletion of draft invoices
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft invoices can be deleted" },
        { status: 400 }
      );
    }

    await db.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
