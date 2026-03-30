import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const cartItemSchema = z.object({
  referenceId: z.string(), // Product ID
  name: z.string(),
  price: z.number(),
  quantity: z.number().int().positive(),
  details: z.record(z.string(), z.any()).optional(),
});

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Cart cannot be empty"),
  paymentMethod: z.enum(["CARD", "CASH"]),
  paymentLinkId: z.string().optional(), // For card payments
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  userId: z.string().optional(),
});

// POST /api/pos/checkout - Process a POS checkout
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const storeBlocked = await checkFeatureGate(session.user.organizationId, "store");
    if (storeBlocked) return storeBlocked;

    const body = await request.json();
    const validatedData = checkoutSchema.parse(body);

    const productIds = validatedData.items.map((item) => item.referenceId);

    // Pre-flight check: verify products exist and are active (fast feedback)
    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        organizationId: session.user.organizationId,
      },
      include: { variants: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of validatedData.items) {
      const product = productMap.get(item.referenceId);
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.name}` }, { status: 400 });
      }
      if (!product.isActive) {
        return NextResponse.json(
          { error: `Product is no longer available: ${item.name}` },
          { status: 400 }
        );
      }
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        taxRate: true,
        taxEnabled: true,
        taxPaidBy: true,
        processingFeePaidBy: true,
        subscription: {
          select: {
            plan: {
              select: {
                transactionFee: true,
                perTransactionFee: true,
              },
            },
          },
        },
      },
    });
    const taxRate = org?.taxEnabled !== false ? Number(org?.taxRate ?? 0) : 0;
    const taxPaidBy = org?.taxPaidBy ?? "CUSTOMER";
    const processingFeePaidBy = org?.processingFeePaidBy ?? "CUSTOMER";
    const planTransactionFee = org?.subscription?.plan
      ? Number(org.subscription.plan.transactionFee)
      : 0;
    const planPerTransactionFee = org?.subscription?.plan
      ? Number(org.subscription.plan.perTransactionFee)
      : 0;

    const reference = `POS-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // Collect variant IDs that need locking
    const variantIds = validatedData.items
      .map((item) => item.details?.variantId as string | undefined)
      .filter(Boolean) as string[];

    const result = await db.$transaction(async (tx) => {
      // Lock product rows to prevent concurrent inventory modifications
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`
      );

      // Lock variant rows if any
      if (variantIds.length > 0) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "ProductVariant" WHERE id IN (${Prisma.join(variantIds)}) FOR UPDATE`
        );
      }

      const freshProducts = await tx.product.findMany({
        where: {
          id: { in: productIds },
          organizationId: session.user.organizationId,
        },
        include: { variants: true },
      });
      const freshMap = new Map(freshProducts.map((p) => [p.id, p]));

      // Build variant map for quick lookup
      const freshVariantMap = new Map<string, (typeof freshProducts)[0]["variants"][0]>();
      for (const p of freshProducts) {
        for (const v of p.variants) {
          freshVariantMap.set(v.id, v);
        }
      }

      // Validate inventory with fresh data
      for (const item of validatedData.items) {
        const product = freshMap.get(item.referenceId);
        if (!product || !product.isActive) {
          throw new Error(`Product no longer available: ${item.name}`);
        }

        const variantId = item.details?.variantId as string | undefined;
        if (variantId) {
          const variant = freshVariantMap.get(variantId);
          if (!variant || !variant.isActive) {
            throw new Error(`Variant no longer available for ${item.name}`);
          }
          if (variant.currentInventory !== null && variant.currentInventory < item.quantity) {
            throw new Error(
              `Insufficient inventory for ${item.name} (${variant.label}). Only ${variant.currentInventory} available.`
            );
          }
        } else {
          if (product.currentInventory !== null && product.currentInventory < item.quantity) {
            throw new Error(
              `Insufficient inventory for ${item.name}. Only ${product.currentInventory} available.`
            );
          }
        }
      }

      const subtotal = validatedData.items.reduce((sum, item) => {
        const product = freshMap.get(item.referenceId)!;
        const variantId = item.details?.variantId as string | undefined;
        let unitPrice = Number(product.price);
        if (variantId) {
          const variant = freshVariantMap.get(variantId);
          if (variant?.price !== null && variant?.price !== undefined) {
            unitPrice = Number(variant.price);
          }
        }
        return sum + unitPrice * item.quantity;
      }, 0);
      const tax = Math.round(subtotal * taxRate * 100) / 100;

      const feeBase = taxPaidBy === "CUSTOMER" ? subtotal + tax : subtotal;
      const processingFeeRaw =
        feeBase > 0 ? feeBase * planTransactionFee + planPerTransactionFee : 0;
      const processingFee = Math.round(processingFeeRaw * 100) / 100;

      let total = subtotal;
      if (taxPaidBy === "CUSTOMER") total += tax;
      if (processingFeePaidBy === "CUSTOMER") total += processingFee;
      total = Math.round(total * 100) / 100;

      const invoice = await tx.invoice.create({
        data: {
          reference,
          userId: validatedData.userId || undefined,
          organizationId: session.user.organizationId,
          status: validatedData.paymentMethod === "CASH" ? "PAID" : "DRAFT",
          dueDate: new Date(),
          subtotal,
          tax,
          processingFee,
          total,
          notes: `POS Sale - ${validatedData.paymentMethod}`,
        },
      });

      const defaultProductGLCode = await tx.gLCode.findFirst({
        where: {
          organizationId: session.user.organizationId,
          isDefault: true,
          defaultForType: "PRODUCT",
        },
        select: { id: true },
      });

      const lineItems = await Promise.all(
        validatedData.items.map((item) => {
          const product = freshMap.get(item.referenceId)!;
          const variantId = item.details?.variantId as string | undefined;
          let verifiedPrice = Number(product.price);
          if (variantId) {
            const variant = freshVariantMap.get(variantId);
            if (variant?.price !== null && variant?.price !== undefined) {
              verifiedPrice = Number(variant.price);
            }
          }
          return tx.lineItem.create({
            data: {
              invoiceId: invoice.id,
              description: item.name,
              quantity: item.quantity,
              unitPrice: verifiedPrice,
              total: verifiedPrice * item.quantity,
              productId: product.id,
              productVariantId: variantId || undefined,
              glCodeId: product?.glCodeId ?? defaultProductGLCode?.id ?? undefined,
            },
          });
        })
      );

      if (processingFeePaidBy === "CUSTOMER" && processingFee > 0) {
        await tx.lineItem.create({
          data: {
            invoiceId: invoice.id,
            description: "Processing Fee",
            quantity: 1,
            unitPrice: processingFee,
            total: processingFee,
          },
        });
      }

      await tx.order.create({
        data: {
          invoiceId: invoice.id,
          organizationId: session.user.organizationId,
          source: "POS",
          fulfillmentStatus: "FULFILLED",
          fulfilledAt: new Date(),
          fulfilledBy: session.user.id,
          customerName: "Walk-in",
        },
      });

      if (validatedData.paymentMethod === "CASH") {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            userId: validatedData.userId || undefined,
            amount: total,
            method: "CASH",
            status: "COMPLETED",
            processedAt: new Date(),
          },
        });
      }

      // Decrement inventory
      for (const item of validatedData.items) {
        const product = freshMap.get(item.referenceId)!;
        const variantId = item.details?.variantId as string | undefined;

        if (variantId) {
          const variant = freshVariantMap.get(variantId)!;
          if (variant.currentInventory === null) continue;

          const previousQty = variant.currentInventory;
          const newQty = previousQty - item.quantity;

          await tx.productVariant.update({
            where: { id: variantId },
            data: { currentInventory: newQty },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              productVariantId: variantId,
              type: "SALE",
              quantity: -item.quantity,
              previousQty,
              newQty,
              referenceId: invoice.id,
              notes: `POS Sale: ${reference}`,
              createdBy: session.user.id,
            },
          });
        } else {
          if (product.currentInventory === null) continue;

          const previousQty = product.currentInventory;
          const newQty = previousQty - item.quantity;

          await tx.product.update({
            where: { id: product.id },
            data: { currentInventory: newQty },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: "SALE",
              quantity: -item.quantity,
              previousQty,
              newQty,
              referenceId: invoice.id,
              notes: `POS Sale: ${reference}`,
              createdBy: session.user.id,
            },
          });
        }
      }

      return { invoice, lineItems, total };
    });

    return NextResponse.json({
      invoiceId: result.invoice.id,
      reference: result.invoice.reference,
      status: result.invoice.status,
      total: result.invoice.total,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (
      error instanceof Error &&
      (error.message.startsWith("Insufficient inventory") ||
        error.message.startsWith("Product no longer") ||
        error.message.startsWith("Variant no longer"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error processing checkout:", error);
    return NextResponse.json({ error: "Failed to process checkout" }, { status: 500 });
  }
}
