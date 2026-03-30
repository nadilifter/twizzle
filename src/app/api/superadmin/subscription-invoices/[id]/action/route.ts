import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { processInvoicePayment } from "@/lib/subscription-billing";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

// tenant-isolation-ok: SubscriptionInvoice is a platform-level model; superadmin-only

const voidSchema = z.object({
  action: z.literal("void"),
  reason: z.string().min(1, "Reason is required when voiding an invoice"),
});

const markPaidSchema = z.object({
  action: z.literal("mark-paid"),
  note: z.string().min(1, "A note explaining why this was manually marked as paid is required"),
});

const adjustSchema = z.object({
  action: z.literal("adjust-amount"),
  newAmount: z.number().min(0, "Amount must be non-negative"),
  reason: z.string().min(1, "Reason is required when adjusting an invoice amount"),
});

const addNoteSchema = z.object({
  action: z.literal("add-note"),
  note: z.string().min(1, "Note content is required"),
});

const retrySchema = z.object({
  action: z.literal("retry"),
});

const actionSchema = z.discriminatedUnion("action", [
  voidSchema,
  markPaidSchema,
  adjustSchema,
  addNoteSchema,
  retrySchema,
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: invoiceId } = await params;
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const invoice = await db.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const data = parsed.data;
    const adminId = session.user.id;
    const adminName = session.user.name ?? session.user.email ?? "Superadmin";

    switch (data.action) {
      case "void": {
        if (invoice.status === "VOID") {
          return NextResponse.json({ error: "Invoice is already voided" }, { status: 400 });
        }
        if (invoice.status === "PAID") {
          return NextResponse.json(
            { error: "Cannot void a paid invoice. Issue a refund instead." },
            { status: 400 }
          );
        }

        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "VOID",
            voidedBy: adminId,
            voidedAt: new Date(),
            notes: appendNote(invoice.notes, `VOIDED by ${adminName}: ${data.reason}`),
          },
        });

        logger.info("Subscription invoice voided by superadmin", {
          invoiceId,
          adminId,
          reason: data.reason,
          organizationId: invoice.organizationId,
        });

        return NextResponse.json({
          success: true,
          message: `Invoice ${invoice.reference} has been voided.`,
        });
      }

      case "mark-paid": {
        if (invoice.status === "PAID") {
          return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
        }
        if (invoice.status === "VOID") {
          return NextResponse.json(
            { error: "Cannot mark a voided invoice as paid" },
            { status: 400 }
          );
        }

        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "PAID",
            paidAt: new Date(),
            markedPaidBy: adminId,
            markedPaidNote: data.note,
            notes: appendNote(invoice.notes, `MANUALLY PAID by ${adminName}: ${data.note}`),
          },
        });

        // Clear grace period if this org was in one
        await db.organization.update({
          where: { id: invoice.organizationId },
          data: {
            scheduledDeactivationDate: null,
            dunningWarningsSent: Prisma.DbNull,
          },
        });

        await db.organizationSubscription.updateMany({
          where: { organizationId: invoice.organizationId, status: "PAST_DUE" },
          data: { status: "ACTIVE" },
        });

        logger.info("Subscription invoice manually marked as paid by superadmin", {
          invoiceId,
          adminId,
          note: data.note,
          organizationId: invoice.organizationId,
        });

        return NextResponse.json({
          success: true,
          message: `Invoice ${invoice.reference} has been marked as paid. Grace period cleared.`,
        });
      }

      case "adjust-amount": {
        if (invoice.status === "PAID") {
          return NextResponse.json(
            {
              error:
                "Cannot adjust a paid invoice. Void it and create a new one, or issue a refund.",
            },
            { status: 400 }
          );
        }
        if (invoice.status === "VOID") {
          return NextResponse.json({ error: "Cannot adjust a voided invoice" }, { status: 400 });
        }

        const originalAmount = Number(invoice.amount);

        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: {
            amount: data.newAmount,
            adjustedFrom: invoice.adjustedFrom ?? originalAmount,
            notes: appendNote(
              invoice.notes,
              `ADJUSTED by ${adminName}: $${originalAmount.toFixed(2)} → $${data.newAmount.toFixed(2)}. Reason: ${data.reason}`
            ),
          },
        });

        logger.info("Subscription invoice amount adjusted by superadmin", {
          invoiceId,
          adminId,
          originalAmount,
          newAmount: data.newAmount,
          reason: data.reason,
          organizationId: invoice.organizationId,
        });

        return NextResponse.json({
          success: true,
          message: `Invoice ${invoice.reference} adjusted from $${originalAmount.toFixed(2)} to $${data.newAmount.toFixed(2)}.`,
        });
      }

      case "add-note": {
        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: {
            notes: appendNote(invoice.notes, `${adminName}: ${data.note}`),
          },
        });

        return NextResponse.json({
          success: true,
          message: "Note added to invoice.",
        });
      }

      case "retry": {
        if (invoice.status === "PAID") {
          return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
        }
        if (invoice.status === "VOID") {
          return NextResponse.json({ error: "Cannot retry a voided invoice" }, { status: 400 });
        }

        if (invoice.status !== "PENDING") {
          await db.subscriptionInvoice.update({
            where: { id: invoiceId },
            data: { status: "PENDING" },
          });
        }

        const success = await processInvoicePayment(invoiceId);

        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: {
            notes: appendNote(
              invoice.notes,
              `RETRY by ${adminName}: ${success ? "succeeded" : "failed"}`
            ),
          },
        });

        return NextResponse.json({
          success,
          message: success
            ? `Payment for ${invoice.reference} processed successfully.`
            : `Payment for ${invoice.reference} failed. All payment methods were attempted.`,
        });
      }
    }
  } catch (error) {
    console.error("Error performing invoice action:", error);
    return NextResponse.json({ error: "Failed to perform invoice action" }, { status: 500 });
  }
}

function appendNote(existing: string | null, newNote: string): string {
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = `[${timestamp}] ${newNote}`;
  return existing ? `${existing}\n${entry}` : entry;
}
