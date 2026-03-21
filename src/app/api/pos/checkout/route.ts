import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
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

    const posBlocked = await checkFeatureGate(session.user.organizationId, "pointOfSale");
    if (posBlocked) return posBlocked;

    const body = await request.json();
    const validatedData = checkoutSchema.parse(body);

    // Validate products and check inventory
    const productIds = validatedData.items.map((item) => item.referenceId);
    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        organizationId: session.user.organizationId,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check all products exist and have sufficient inventory
    for (const item of validatedData.items) {
      const product = productMap.get(item.referenceId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.name}` },
          { status: 400 }
        );
      }
      if (!product.isActive) {
        return NextResponse.json(
          { error: `Product is no longer available: ${item.name}` },
          { status: 400 }
        );
      }
      // Check inventory if not unlimited
      if (product.currentInventory !== null) {
        if (product.currentInventory < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient inventory for ${item.name}. Only ${product.currentInventory} available.` },
            { status: 400 }
          );
        }
      }
    }

    // Recalculate totals server-side using verified DB prices
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { taxRate: true, taxEnabled: true },
    });
    const taxRate = org?.taxEnabled !== false
      ? Number(org?.taxRate ?? 0)
      : 0;

    const subtotal = validatedData.items.reduce((sum, item) => {
      const product = productMap.get(item.referenceId)!;
      return sum + Number(product.price) * item.quantity;
    }, 0);
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const reference = `POS-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const result = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          reference,
          userId: validatedData.userId || undefined,
          organizationId: session.user.organizationId,
          status: validatedData.paymentMethod === "CASH" ? "PAID" : "DRAFT",
          dueDate: new Date(),
          subtotal,
          tax,
          total,
          notes: `POS Sale - ${validatedData.paymentMethod}`,
        },
      });

      const defaultProductGLCode = await tx.gLCode.findFirst({
        where: { organizationId: session.user.organizationId, isDefault: true, defaultForType: "PRODUCT" },
        select: { id: true },
      });

      const lineItems = await Promise.all(
        validatedData.items.map((item) => {
          const product = productMap.get(item.referenceId)!;
          const verifiedPrice = Number(product.price);
          return tx.lineItem.create({
            data: {
              invoiceId: invoice.id,
              description: item.name,
              quantity: item.quantity,
              unitPrice: verifiedPrice,
              total: verifiedPrice * item.quantity,
              glCodeId: product?.glCodeId ?? defaultProductGLCode?.id ?? undefined,
            },
          });
        })
      );

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

      // Decrement inventory and create stock movements
      for (const item of validatedData.items) {
        const product = productMap.get(item.referenceId)!;
        
        // Skip if unlimited inventory
        if (product.currentInventory === null) continue;

        const previousQty = product.currentInventory;
        const newQty = previousQty - item.quantity;

        // Update product inventory
        await tx.product.update({
          where: { id: product.id },
          data: { currentInventory: newQty },
        });

        // Create stock movement record
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

      return { invoice, lineItems };
    });

    return NextResponse.json({
      invoiceId: result.invoice.id,
      reference: result.invoice.reference,
      status: result.invoice.status,
      total: result.invoice.total,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error processing checkout:", error);
    return NextResponse.json(
      { error: "Failed to process checkout" },
      { status: 500 }
    );
  }
}
