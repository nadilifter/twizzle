import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { refundPayment } from "@/lib/adyen-platform";
import { Prisma } from "@prisma/client";

/**
 * POST /api/transactions/[id]/refund
 *
 * Initiate a refund for a completed payment transaction.
 * Supports full and partial refunds. The refund Transaction is created
 * with status PENDING and updated to SETTLED when the Adyen REFUND webhook arrives.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions ?? [];
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { amount: requestedAmount, reason } = body as {
      amount?: number;
      reason?: string;
    };

    const transaction = await db.transaction.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: { payment: { include: { invoice: true } } },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.type !== "PAYMENT") {
      return NextResponse.json(
        { error: "Only payment transactions can be refunded" },
        { status: 400 }
      );
    }

    if (transaction.status !== "SETTLED" && transaction.status !== "CAPTURED") {
      return NextResponse.json(
        { error: "Transaction must be settled or captured to refund" },
        { status: 400 }
      );
    }

    const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT;
    if (!merchantAccount) {
      return NextResponse.json({ error: "Payment provider not configured" }, { status: 503 });
    }

    // Validate refund amount and create a PENDING refund record atomically
    // inside the same FOR UPDATE transaction. This prevents concurrent partial
    // refunds from exceeding the original amount — the second request will see
    // the PENDING record created by the first and adjust/reject accordingly.
    const { refundAmount, isFullRefund, refundRef, pendingRefundId } = await db.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Transaction" WHERE id = ${transaction.id} FOR UPDATE`
        );

        const existingRefunds = await tx.transaction.findMany({
          where: {
            type: "REFUND",
            metadata: { path: ["originalPspReference"], equals: transaction.pspReference },
          },
          select: { amount: true, status: true },
        });

        const totalRefunded = existingRefunds.reduce(
          (sum, r) => sum + Math.abs(Number(r.amount)),
          0
        );
        const originalAmount = Number(transaction.amount);

        const amount = requestedAmount ?? originalAmount - totalRefunded;
        if (amount <= 0) {
          throw new RefundValidationError("Transaction has already been fully refunded");
        }

        if (amount > originalAmount - totalRefunded) {
          throw new RefundValidationError(
            `Refund amount ($${amount.toFixed(2)}) exceeds remaining refundable amount ($${(originalAmount - totalRefunded).toFixed(2)})`
          );
        }

        const ref = `refund-${transaction.pspReference}-${Date.now()}`;

        const pending = await tx.transaction.create({
          data: {
            organizationId: transaction.organizationId,
            pspReference: ref,
            merchantRef: transaction.merchantRef,
            type: "REFUND",
            amount: -amount,
            currency: transaction.currency,
            status: "PENDING",
            method: transaction.method,
            description: `Refund – ${transaction.merchantRef || transaction.pspReference}${reason ? ` (${reason})` : ""}`,
            metadata: {
              originalPspReference: transaction.pspReference,
              reason: reason || null,
            },
          },
        });

        return {
          refundAmount: amount,
          isFullRefund: amount >= originalAmount - totalRefunded,
          refundRef: ref,
          pendingRefundId: pending.id,
        };
      }
    );

    let response;
    try {
      response = await refundPayment(
        transaction.pspReference,
        {
          value: Math.round(refundAmount * 100),
          currency: transaction.currency,
        },
        merchantAccount,
        refundRef
      );
    } catch (adyenError) {
      await db.transaction.delete({ where: { id: pendingRefundId } });
      throw adyenError;
    }

    const refundTx = await db.transaction.update({
      where: { id: pendingRefundId },
      data: { pspReference: response.pspReference },
    });

    if (isFullRefund && transaction.paymentId) {
      const payment = transaction.payment;
      const invoiceId = payment?.invoiceId;
      if (payment && invoiceId) {
        await db.$transaction(async (tx) => {
          await tx.payment.update({
            where: {
              id: payment.id,
              invoice: { organizationId: session.user.organizationId },
            },
            data: { status: "REFUNDED" },
          });
          await tx.invoice.update({
            where: {
              id: invoiceId,
              organizationId: session.user.organizationId,
            },
            data: { status: "CANCELLED" },
          });
        });
      }
    }

    return NextResponse.json(refundTx);
  } catch (error: any) {
    if (error instanceof RefundValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Refund API error:", error);
    return NextResponse.json({ error: "Refund failed" }, { status: 500 });
  }
}

class RefundValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundValidationError";
  }
}
