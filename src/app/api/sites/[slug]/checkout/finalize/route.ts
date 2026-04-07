import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { processInvoiceRegistrations, type InvoiceMetadata } from "@/lib/invoice-processing";
import { sendTemplatedEmail } from "@/lib/email";
import { getSubdomainUrl } from "@/lib/env-domains";
import { logger } from "@/lib/logger";

/**
 * POST /api/sites/[slug]/checkout/finalize
 *
 * Client-side complement to the Adyen webhook for processing paid invoices.
 * Called from the checkout page after Adyen's onPaymentCompleted fires.
 *
 * In environments where the Adyen webhook can't reach the server (local dev
 * without a tunnel), this endpoint ensures registrations and confirmation
 * emails still happen. All operations are idempotent — safe to run even if
 * the webhook has already (or will later) process the same invoice.
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { invoiceId, paymentMethodType } = await request.json();

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
    }

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: params.slug },
      select: { organizationId: true },
    });
    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId, organizationId: config.organizationId },
      include: {
        lineItems: true,
        user: { select: { id: true, email: true, name: true } },
        organization: {
          select: {
            id: true,
            name: true,
            subscription: {
              select: {
                plan: {
                  select: { transactionFee: true, perTransactionFee: true },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.registrationsProcessed) {
      return NextResponse.json({ success: true, status: "already_processed" });
    }

    // If still DRAFT the webhook hasn't created a payment yet — do it here.
    // The transaction uses SELECT FOR UPDATE to prevent races with the webhook.
    if (invoice.status === "DRAFT") {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`);
        const inv = await tx.invoice.findFirst({
          where: { id: invoiceId, status: "DRAFT" },
          select: { id: true, total: true, reference: true },
        });
        if (!inv) return;

        const paymentAmount = Number(inv.total);

        const payment = await tx.payment.create({
          data: {
            invoiceId: inv.id,
            userId: invoice.userId || undefined,
            amount: paymentAmount,
            method: ["ach", "paybybank_us", "sepadirectdebit", "ideal", "banktransfer"].includes(
              (paymentMethodType || "").toLowerCase()
            )
              ? "BANK"
              : "CARD",
            status: "COMPLETED",
            processedAt: new Date(),
          },
        });

        const finPlan = invoice.organization.subscription?.plan;
        await tx.transaction.create({
          data: {
            organizationId: config.organizationId,
            paymentId: payment.id,
            pspReference: `FINALIZE-${inv.id}`,
            merchantRef: inv.reference,
            type: "PAYMENT",
            amount: paymentAmount,
            currency: "USD",
            status: "SETTLED",
            method: paymentMethodType || "card",
            description: `Online payment – ${inv.reference}`,
            settledAt: new Date(),
            feeRate: finPlan ? Number(finPlan.transactionFee) : null,
            feeFixed: finPlan ? Number(finPlan.perTransactionFee) : null,
          },
        });

        await tx.invoice.update({
          where: { id: inv.id },
          data: { status: "PAID" },
        });
      });
    }

    // Process registrations (upserts are idempotent)
    if (invoice.notes) {
      try {
        const metadata: InvoiceMetadata = JSON.parse(invoice.notes);

        const cartItems = invoice.lineItems
          .filter((li) => !li.productId && !li.discountId)
          .map((li) => ({
            referenceId:
              li.programId || li.membershipInstanceId || li.passId || li.competitionId || li.id,
            type: li.competitionId
              ? ("competition" as const)
              : li.membershipInstanceId
                ? ("membership" as const)
                : li.passId
                  ? ("pass" as const)
                  : ("program" as const),
            athleteId: li.athleteId || undefined,
            details: {
              programId: li.programId || undefined,
              membershipInstanceId: li.membershipInstanceId || undefined,
              passId: li.passId || undefined,
              competitionId: li.competitionId || undefined,
            },
          }));

        await processInvoiceRegistrations(
          metadata,
          cartItems,
          invoice.userId,
          invoice.organizationId
        );
      } catch (err) {
        console.error(`Finalize: failed to process registrations for ${invoiceId}:`, err);
      }
    }

    // Decrement inventory for store product line items
    const productLineItems = invoice.lineItems.filter((li) => li.productId);
    if (productLineItems.length > 0) {
      try {
        const productIds = productLineItems.map((li) => li.productId!);
        const variantIdsForLock = productLineItems
          .map((li) => li.productVariantId)
          .filter(Boolean) as string[];
        await db.$transaction(async (tx) => {
          const existingMovement = await tx.stockMovement.findFirst({
            where: { referenceId: invoice.id, type: "SALE" },
            select: { id: true },
          });
          if (existingMovement) return;

          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`
          );
          if (variantIdsForLock.length > 0) {
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(variantIdsForLock)}) FOR UPDATE`
            );
          }
          for (const li of productLineItems) {
            if (li.productVariantId) {
              const variant = await tx.productVariant.findUnique({
                where: { id: li.productVariantId },
                select: { id: true, currentInventory: true },
              });
              if (variant && variant.currentInventory !== null) {
                const previousQty = variant.currentInventory;
                const newQty = Math.max(previousQty - li.quantity, 0);
                await tx.productVariant.update({
                  where: { id: variant.id },
                  data: { currentInventory: newQty },
                });
                await tx.stockMovement.create({
                  data: {
                    productId: li.productId!,
                    productVariantId: li.productVariantId,
                    type: "SALE",
                    quantity: -li.quantity,
                    previousQty,
                    newQty,
                    referenceId: invoice.id,
                    notes: `Online Sale: ${invoice.reference}`,
                    createdBy: invoice.userId || undefined,
                  },
                });
              }
            } else {
              const product = await tx.product.findUnique({
                where: { id: li.productId! },
                select: { id: true, currentInventory: true },
              });
              if (product && product.currentInventory !== null) {
                const previousQty = product.currentInventory;
                const newQty = Math.max(previousQty - li.quantity, 0);
                await tx.product.update({
                  where: { id: product.id },
                  data: { currentInventory: newQty },
                });
                await tx.stockMovement.create({
                  data: {
                    productId: product.id,
                    type: "SALE",
                    quantity: -li.quantity,
                    previousQty,
                    newQty,
                    referenceId: invoice.id,
                    notes: `Online Sale: ${invoice.reference}`,
                    createdBy: invoice.userId || undefined,
                  },
                });
              }
            }
          }
        });
      } catch (err) {
        console.error(`Finalize: failed to process inventory for ${invoiceId}:`, err);
      }
    }

    await db.invoice.update({
      where: { id: invoice.id },
      data: { registrationsProcessed: true },
    });

    // Send receipt email
    try {
      const recipientEmail = invoice.user?.email;
      const recipientName = invoice.user?.name?.split(" ")[0];

      if (recipientEmail) {
        const slug = params.slug;
        const receiptUrl = `${getSubdomainUrl(slug)}/receipt/${invoice.id}`;

        const lineItemsHtml = invoice.lineItems
          .map(
            (li) =>
              `<tr><td style="padding: 4px 0;">${li.description}</td><td style="padding: 4px 0; text-align: right;">$${Number(li.total).toFixed(2)}</td></tr>`
          )
          .join("");
        const lineItemsText = invoice.lineItems
          .map((li) => `${li.description} — $${Number(li.total).toFixed(2)}`)
          .join("\n");

        const invoiceTax = Number(invoice.tax);
        const taxHtml =
          invoiceTax > 0
            ? `<tr><td style="padding: 4px 0;">Tax</td><td style="padding: 4px 0; text-align: right;">$${invoiceTax.toFixed(2)}</td></tr>`
            : "";
        const processingFeeHtml = "";
        const taxText = invoiceTax > 0 ? `Tax: $${invoiceTax.toFixed(2)}` : "";
        const processingFeeText = "";

        sendTemplatedEmail("checkout-receipt", [recipientEmail], {
          name: recipientName || "Customer",
          reference: invoice.reference,
          subtotal: `$${Number(invoice.subtotal).toFixed(2)}`,
          total: `$${Number(invoice.total).toFixed(2)}`,
          lineItemsHtml,
          lineItemsText,
          taxHtml,
          processingFeeHtml,
          taxText,
          processingFeeText,
          receiptUrl,
        }).catch((err) => console.error("Finalize: failed to send receipt email:", err));
      }
    } catch (err) {
      console.error("Finalize: error sending receipt email:", err);
    }

    logger.info("Finalize: invoice processed", { invoiceId });
    return NextResponse.json({ success: true, status: "processed" });
  } catch (error) {
    console.error("Finalize endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
