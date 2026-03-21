import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const updateProductSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  category: z.string().optional(),
  price: z.number().min(0, "Price must be positive").optional(),
  imageUrl: z.string().optional().nullable(),
  maxInventory: z.number().int().positive().optional().nullable(),
  currentInventory: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  glCodeId: z.string().optional().nullable(),
});

// GET /api/products/[id] - Get a single product
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

    const product = await scopedDb.product.findFirst({
      where: { id },
      include: {
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Update a product
export async function PUT(
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
      !session.user.permissions?.includes("financials.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    // Verify product exists and belongs to organization
    const existingProduct = await scopedDb.product.findFirst({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateProductSchema.parse(body);

    if (validatedData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: validatedData.glCodeId } });
      if (!glCode) {
        return NextResponse.json({ error: "GL code not found" }, { status: 404 });
      }
    }

    // Check if SKU already exists for another product (if updating SKU)
    if (validatedData.sku && validatedData.sku !== existingProduct.sku) {
      const skuExists = await scopedDb.product.findFirst({
        where: { 
          sku: validatedData.sku,
          id: { not: id },
        },
      });

      if (skuExists) {
        return NextResponse.json(
          { error: "A product with this SKU already exists" },
          { status: 400 }
        );
      }
    }

    const product = await scopedDb.product.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Soft delete (deactivate) a product
export async function DELETE(
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
      !session.user.permissions?.includes("products.delete") &&
      !session.user.permissions?.includes("financials.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    // Verify product exists and belongs to organization
    const existingProduct = await scopedDb.product.findFirst({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const product = await scopedDb.product.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
