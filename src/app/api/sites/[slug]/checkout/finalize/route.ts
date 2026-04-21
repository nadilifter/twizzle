import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { getAuthSession } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/email";
import { processInvoiceRegistrations, buildRegistrationArgs } from "@/lib/invoice-processing";
import { sendCheckoutSetupEmailIfNeeded } from "@/lib/checkout-user-provisioning";

/**
 * POST /api/sites/[slug]/checkout/finalize
 *
 * Two roles:
 * 1. Paid orders: thin status-check called fire-and-forget after Adyen's onPaymentCompleted.
 *    Does no processing — the webhook owns everything.
 * 2. $0 DRAFT invoices: completes the order on explicit user confirmation
 *    (CASH payment, inventory decrement, receipt email).
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { invoiceId } = await request.json();

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
      select: {
        id: true,
        status: true,
        postPaymentProcessed: true,
        userId: true,
        reference: true,
        total: true,
        lineItems: {
          select: {
            id: true,
            description: true,
            unitPrice: true,
            quantity: true,
            productId: true,
            productVariantId: true,
            programId: true,
            membershipInstanceId: true,
            passId: true,
            competitionId: true,
            athleteId: true,
            discountId: true,
          },
        },
        user: {
          select: { email: true, name: true },
        },
        notes: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    //
    if (invoice.userId) {
      sendCheckoutSetupEmailIfNeeded(invoice.userId).catch((err) =>
        logger.error("Finalize: failed to send account setup email", {
          err,
          userId: invoice.userId,
        })
      );
    }

    // Ownership check: authenticated users must own this invoice.
    // Guest invoices (userId = null) are exempt.
    const authSession = await getAuthSession();
    if (authSession?.user?.id && invoice.userId && authSession.user.id !== invoice.userId) {
      logger.warn("Finalize: unauthorized status check", {
        callerId: authSession.user.id,
        invoiceUserId: invoice.userId,
        invoiceId,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // $0 DRAFT completion — called when user clicks "Confirm Order" on the confirmation screen
    if (invoice.status === "DRAFT" && Number(invoice.total) === 0) {
      const productLineItems: typeof invoice.lineItems = [];
      let hasRegistrations = false;
      for (const li of invoice.lineItems) {
        if (li.productId) {
          productLineItems.push(li);
        } else if (li.programId || li.membershipInstanceId || li.passId || li.competitionId) {
          hasRegistrations = true;
        }
      }

      // Single atomic transaction covering payment record, transaction record, invoice status and inventory decrement.
      // All four must succeed together — if inventory fails we don't
      // want a paid invoice with no stock movement, and if the invoice update fails we don't
      // want orphaned payment records.
      let wasAlreadyProcessed = false;
      await db.$transaction(async (tx) => {
        // Lock the invoice row and re-verify it's still DRAFT inside the transaction.
        // Prevents double-processing if the client calls finalize twice concurrently
        // (double-click, network retry, etc.).
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`
        );
        const fresh = await tx.invoice.findUnique({
          where: { id: invoice.id },
          select: { status: true },
        });
        if (fresh?.status !== "DRAFT") {
          wasAlreadyProcessed = true;
          return;
        }

        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            userId: invoice.userId || undefined,
            amount: 0,
            method: "CASH",
            status: "COMPLETED",
            processedAt: new Date(),
          },
        });

        await tx.transaction.create({
          data: {
            organizationId: config.organizationId,
            paymentId: payment.id,
            pspReference: `FREE-${invoice.id}`,
            merchantRef: invoice.reference,
            type: "PAYMENT",
            amount: 0,
            currency: "USD",
            status: "SETTLED",
            method: "comp",
            description: `Free checkout – ${invoice.reference}`,
            settledAt: new Date(),
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID" },
        });

        // Inventory decrement inside the same transaction — payment + inventory is all-or-nothing
        if (productLineItems.length > 0) {
          const productIds = productLineItems.map((li) => li.productId!);
          const variantIds = productLineItems
            .map((li) => li.productVariantId)
            .filter(Boolean) as string[];
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`
          );
          if (variantIds.length > 0) {
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(variantIds)}) FOR UPDATE`
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
        }
      });

      if (wasAlreadyProcessed) {
        return NextResponse.json({ success: true, status: "PAID", invoiceId: invoice.id });
      }

      // Process registrations (programs, memberships, passes, competitions).
      // Runs outside the payment transaction since processInvoiceRegistrations
      // manages its own internal transactions (capacity locks, upserts, etc.).
      if (hasRegistrations) {
        try {
          const { metadata, items } = buildRegistrationArgs(invoice.lineItems, invoice.notes);
          await processInvoiceRegistrations(metadata, items, invoice.userId, config.organizationId);
        } catch (err) {
          logger.error("CRITICAL: Registration processing failed after payment committed", {
            invoiceId: invoice.id,
            invoiceReference: invoice.reference,
            userId: invoice.userId,
            organizationId: config.organizationId,
            error: err instanceof Error ? err.message : String(err),
          });
          return NextResponse.json(
            { error: "Your order was placed but enrollment failed. Please contact support." },
            { status: 500 }
          );
        }
      }

      await db.invoice.update({
        where: { id: invoice.id },
        data: { postPaymentProcessed: true },
      });

      // Receipt email (fire-and-forget; only sent for authenticated users where email is available)
      if (invoice.user) {
        const protocol = request.headers.get("x-forwarded-proto") || "http";
        const host = request.headers.get("host");
        const receiptUrl = `${protocol}://${host}/receipt/${invoice.id}`;
        const lineItemsHtml = invoice.lineItems
          .map(
            (li) =>
              `<tr><td style="padding: 4px 0;">${li.description}</td><td style="padding: 4px 0; text-align: right;">$${(Number(li.unitPrice) * li.quantity).toFixed(2)}</td></tr>`
          )
          .join("");
        const lineItemsText = invoice.lineItems
          .map((li) => `${li.description} — $${(Number(li.unitPrice) * li.quantity).toFixed(2)}`)
          .join("\n");
        const firstName = invoice.user.name.split(" ")[0];
        sendTemplatedEmail("checkout-receipt", [invoice.user.email], {
          name: firstName,
          reference: invoice.reference,
          subtotal: "$0.00",
          total: "$0.00",
          lineItemsHtml,
          lineItemsText,
          taxHtml: "",
          processingFeeHtml: "",
          taxText: "",
          processingFeeText: "",
          receiptUrl,
        }).catch((err) =>
          logger.error("Failed to send receipt email", { err, invoiceId: invoice.id })
        );
      }

      return NextResponse.json({ success: true, status: "PAID", invoiceId: invoice.id });
    }

    return NextResponse.json({
      success: true,
      status: invoice.status,
      postPaymentProcessed: invoice.postPaymentProcessed,
    });
  } catch (error) {
    logger.error("Finalize endpoint error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
