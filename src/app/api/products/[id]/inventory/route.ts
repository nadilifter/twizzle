import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const restockSchema = z.object({
  type: z.enum(["add", "set", "max"]),
  quantity: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// POST /api/products/[id]/inventory - Restock a product
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
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Can't restock unlimited inventory items
    if (product.maxInventory === null && product.currentInventory === null) {
      return NextResponse.json(
        { error: "Cannot restock unlimited inventory items" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = restockSchema.parse(body);

    const previousQty = product.currentInventory ?? 0;
    let newQty: number;
    let quantityChange: number;

    switch (validatedData.type) {
      case "add":
        if (validatedData.quantity === undefined) {
          return NextResponse.json(
            { error: "Quantity is required for add operation" },
            { status: 400 }
          );
        }
        newQty = previousQty + validatedData.quantity;
        quantityChange = validatedData.quantity;
        break;

      case "set":
        if (validatedData.quantity === undefined) {
          return NextResponse.json(
            { error: "Quantity is required for set operation" },
            { status: 400 }
          );
        }
        newQty = validatedData.quantity;
        quantityChange = newQty - previousQty;
        break;

      case "max":
        if (product.maxInventory === null) {
          return NextResponse.json(
            { error: "Product has no maximum inventory set" },
            { status: 400 }
          );
        }
        newQty = product.maxInventory;
        quantityChange = newQty - previousQty;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid operation type" },
          { status: 400 }
        );
    }

    // Don't allow negative inventory
    if (newQty < 0) {
      return NextResponse.json(
        { error: "Inventory cannot be negative" },
        { status: 400 }
      );
    }

    // Don't exceed max inventory if set
    if (product.maxInventory !== null && newQty > product.maxInventory) {
      return NextResponse.json(
        { error: `Inventory cannot exceed maximum of ${product.maxInventory}` },
        { status: 400 }
      );
    }

    // Skip if no change
    if (quantityChange === 0) {
      return NextResponse.json(product);
    }

    const updatedProduct = await db.$transaction(async (tx) => {
      const verified = await tx.product.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true },
      });
      if (!verified) {
        throw new Error("Product not found or access denied");
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

      // Update product inventory
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
