import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { Prisma } from "@prisma/client";
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

    const newStatus = validatedData.status;

    const invoice = await db.$transaction(async (tx) => {
      // Lock the invoice row and read its current status inside the
      // transaction so balance adjustments use a consistent oldStatus.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${id} AND "organizationId" = ${session.user.organizationId} FOR UPDATE`
      );

      const existing = await tx.invoice.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true, status: true },
      });
      if (!existing) throw new Error("Not found");

      const oldStatus = existing.status;

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          ...validatedData,
          dueDate: validatedData.dueDate ? parseDateOnly(validatedData.dueDate) ?? undefined : undefined,
        },
        include: {
          lineItems: true,
          payments: true,
        },
      });

      if (newStatus && oldStatus !== newStatus) {
        const amount = Number(updated.total);

        if (oldStatus === "DRAFT" && newStatus === "SENT") {
          if (updated.userId) {
            await tx.user.update({
              where: { id: updated.userId },
              data: { balance: { increment: amount } },
            });
          }
        }

        if ((oldStatus === "SENT" || oldStatus === "OVERDUE") && newStatus === "CANCELLED") {
          if (updated.userId) {
            await tx.user.update({
              where: { id: updated.userId },
              data: { balance: { decrement: amount } },
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json(invoice);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    if (error?.message === "Not found") {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
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

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
