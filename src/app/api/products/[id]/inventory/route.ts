import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const restockSchema = z.object({
  type: z.enum(["add", "set", "max"]),
  quantity: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  variantId: z.string().optional(),
});

// POST /api/products/[id]/inventory - Restock a product or variant
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("products.update") &&
      !session.user.permissions?.includes("inventory.update") &&
      !session.user.permissions?.includes("financials.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    // Verify product exists and belongs to organization
    const product = await scopedDb.product.findFirst({
      where: { id },
      include: { variants: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = restockSchema.parse(body);

    // Variant-level restock
    if (validatedData.variantId) {
      const variant = product.variants.find(v => v.id === validatedData.variantId);
      if (!variant) {
        return NextResponse.json({ error: "Variant not found" }, { status: 404 });
      }
      if (variant.maxInventory === null && variant.currentInventory === null) {
        return NextResponse.json(
          { error: "Cannot restock unlimited inventory variants" },
          { status: 400 }
        );
      }

      if (validatedData.type === "add" && validatedData.quantity === undefined) {
        return NextResponse.json({ error: "Quantity is required for add operation" }, { status: 400 });
      }
      if (validatedData.type === "set" && validatedData.quantity === undefined) {
        return NextResponse.json({ error: "Quantity is required for set operation" }, { status: 400 });
      }
      if (validatedData.type === "max" && variant.maxInventory === null) {
        return NextResponse.json({ error: "Variant has no maximum inventory set" }, { status: 400 });
      }

      const updated = await db.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "ProductVariant" WHERE id = ${validatedData.variantId} FOR UPDATE`
        );

        const fresh = await tx.productVariant.findFirst({
          where: { id: validatedData.variantId, productId: id },
        });
        if (!fresh) throw new Error("Variant not found or access denied");

        const previousQty = fresh.currentInventory ?? 0;
        let newQty: number;
        let quantityChange: number;

        switch (validatedData.type) {
          case "add":
            newQty = previousQty + validatedData.quantity!;
            quantityChange = validatedData.quantity!;
            break;
          case "set":
            newQty = validatedData.quantity!;
            quantityChange = newQty - previousQty;
            break;
          case "max":
            newQty = fresh.maxInventory!;
            quantityChange = newQty - previousQty;
            break;
          default:
            throw new Error("Invalid operation type");
        }

        if (newQty < 0) throw new Error("Inventory cannot be negative");
        if (fresh.maxInventory !== null && newQty > fresh.maxInventory) {
          throw new Error(`Inventory cannot exceed maximum of ${fresh.maxInventory}`);
        }
        if (quantityChange === 0) return fresh;

        await tx.stockMovement.create({
          data: {
            productId: id,
            productVariantId: validatedData.variantId,
            type: quantityChange > 0 ? "RESTOCK" : "ADJUSTMENT",
            quantity: quantityChange,
            previousQty,
            newQty,
            notes: validatedData.notes || `Variant inventory ${validatedData.type}: ${validatedData.quantity ?? "to max"}`,
            createdBy: session.user.id,
          },
        });

        return tx.productVariant.update({
          where: { id: validatedData.variantId },
          data: { currentInventory: newQty },
        });
      });

      return NextResponse.json(updated);
    }

    // Product-level restock (original behavior)
    if (product.maxInventory === null && product.currentInventory === null) {
      return NextResponse.json(
        { error: "Cannot restock unlimited inventory items" },
        { status: 400 }
      );
    }

    if (validatedData.type === "add" && validatedData.quantity === undefined) {
      return NextResponse.json(
        { error: "Quantity is required for add operation" },
        { status: 400 }
      );
    }
    if (validatedData.type === "set" && validatedData.quantity === undefined) {
      return NextResponse.json(
        { error: "Quantity is required for set operation" },
        { status: 400 }
      );
    }
    if (validatedData.type === "max" && product.maxInventory === null) {
      return NextResponse.json(
        { error: "Product has no maximum inventory set" },
        { status: 400 }
      );
    }

    const updatedProduct = await db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Product" WHERE id = ${id} FOR UPDATE`
      );

      const fresh = await tx.product.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      if (!fresh) {
        throw new Error("Product not found or access denied");
      }

      const previousQty = fresh.currentInventory ?? 0;
      let newQty: number;
      let quantityChange: number;

      switch (validatedData.type) {
        case "add":
          newQty = previousQty + validatedData.quantity!;
          quantityChange = validatedData.quantity!;
          break;
        case "set":
          newQty = validatedData.quantity!;
          quantityChange = newQty - previousQty;
          break;
        case "max":
          newQty = fresh.maxInventory!;
          quantityChange = newQty - previousQty;
          break;
        default:
          throw new Error("Invalid operation type");
      }

      if (newQty < 0) {
        throw new Error("Inventory cannot be negative");
      }
      if (fresh.maxInventory !== null && newQty > fresh.maxInventory) {
        throw new Error(`Inventory cannot exceed maximum of ${fresh.maxInventory}`);
      }
      if (quantityChange === 0) {
        return fresh;
      }

      await tx.stockMovement.create({
        data: {
          productId: id,
          type: quantityChange > 0 ? "RESTOCK" : "ADJUSTMENT",
          quantity: quantityChange,
          previousQty,
          newQty,
          notes: validatedData.notes || `Inventory ${validatedData.type}: ${validatedData.quantity ?? "to max"}`,
          createdBy: session.user.id,
        },
      });

      return tx.product.update({
        where: { id },
        data: { currentInventory: newQty },
      });
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("Inventory cannot") || msg.startsWith("Product not found") || msg.startsWith("Variant not found")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      { error: "Failed to update inventory" },
      { status: 500 }
    );
  }
}

// GET /api/products/[id]/inventory - Get stock movement history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    // Verify product exists and belongs to organization
    const product = await scopedDb.product.findFirst({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [movements, total] = await Promise.all([
      db.stockMovement.findMany({
        where: { productId: id },
        include: {
          productVariant: { select: { id: true, label: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.stockMovement.count({ where: { productId: id } }),
    ]);

    return NextResponse.json({
      data: movements,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock movements" },
      { status: 500 }
    );
  }
}
