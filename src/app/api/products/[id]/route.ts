import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const variantSchema = z.object({
  id: z.string().optional(), // present = update, absent = create
  label: z.string().min(1, "Variant label is required"),
  price: z.number().min(0).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  maxInventory: z.number().int().positive().optional().nullable(),
  currentInventory: z.number().int().min(0).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

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
  typeName: z.string().optional().nullable(),
  variants: z.array(variantSchema).optional().nullable(),
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
        variants: { orderBy: { sortOrder: "asc" } },
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

    const existingProduct = await scopedDb.product.findFirst({
      where: { id },
      include: { variants: true },
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

    const wantsVariants = validatedData.typeName !== undefined
      ? !!validatedData.typeName
      : !!existingProduct.typeName;

    if (wantsVariants && validatedData.variants !== undefined && (!validatedData.variants || validatedData.variants.length === 0)) {
      return NextResponse.json(
        { error: "At least one variant option is required when a type is set" },
        { status: 400 }
      );
    }

    const product = await db.$transaction(async (tx) => {
      // Verify ownership inside transaction
      const verified = await tx.product.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true },
      });
      if (!verified) throw new Error("Not found");

      // Build product-level update data
      const productUpdateData: Record<string, unknown> = {};
      if (validatedData.name !== undefined) productUpdateData.name = validatedData.name;
      if (validatedData.description !== undefined) productUpdateData.description = validatedData.description;
      if (validatedData.sku !== undefined) productUpdateData.sku = validatedData.sku;
      if (validatedData.category !== undefined) productUpdateData.category = validatedData.category;
      if (validatedData.price !== undefined) productUpdateData.price = validatedData.price;
      if (validatedData.imageUrl !== undefined) productUpdateData.imageUrl = validatedData.imageUrl;
      if (validatedData.isActive !== undefined) productUpdateData.isActive = validatedData.isActive;
      if (validatedData.glCodeId !== undefined) productUpdateData.glCodeId = validatedData.glCodeId;

      if (validatedData.typeName !== undefined) {
        productUpdateData.typeName = validatedData.typeName || null;
      }

      if (wantsVariants) {
        // Inventory managed at variant level
        productUpdateData.maxInventory = null;
        productUpdateData.currentInventory = null;
      } else if (validatedData.typeName === null || validatedData.typeName === "") {
        // Switching from variants to no-type: accept product-level inventory
        if (validatedData.maxInventory !== undefined) productUpdateData.maxInventory = validatedData.maxInventory;
        if (validatedData.currentInventory !== undefined) productUpdateData.currentInventory = validatedData.currentInventory;
        productUpdateData.typeName = null;
      } else {
        // No type change, just regular product-level inventory updates
        if (validatedData.maxInventory !== undefined) productUpdateData.maxInventory = validatedData.maxInventory;
        if (validatedData.currentInventory !== undefined) productUpdateData.currentInventory = validatedData.currentInventory;
      }

      await tx.product.update({
        where: { id },
        data: productUpdateData,
      });

      // Reconcile variants if provided
      if (validatedData.variants !== undefined) {
        if (!wantsVariants || !validatedData.variants || validatedData.variants.length === 0) {
          // Remove all variants (switching to no-type)
          await tx.productVariant.deleteMany({ where: { productId: id } });
        } else {
          const incomingIds = new Set(validatedData.variants.filter(v => v.id).map(v => v.id!));
          const existingIds = existingProduct.variants.map(v => v.id);

          // Delete removed variants
          const toDelete = existingIds.filter(eid => !incomingIds.has(eid));
          if (toDelete.length > 0) {
            await tx.productVariant.deleteMany({
              where: { id: { in: toDelete }, productId: id },
            });
          }

          // Upsert remaining
          for (let i = 0; i < validatedData.variants.length; i++) {
            const v = validatedData.variants[i];
            if (v.id && existingIds.includes(v.id)) {
              await tx.productVariant.update({
                where: { id: v.id },
                data: {
                  label: v.label,
                  price: v.price ?? null,
                  imageUrl: v.imageUrl ?? null,
                  maxInventory: v.maxInventory ?? null,
                  currentInventory: v.currentInventory ?? null,
                  sortOrder: v.sortOrder ?? i,
                  isActive: v.isActive ?? true,
                },
              });
            } else {
              await tx.productVariant.create({
                data: {
                  productId: id,
                  label: v.label,
                  price: v.price ?? null,
                  imageUrl: v.imageUrl ?? null,
                  maxInventory: v.maxInventory ?? null,
                  currentInventory: v.currentInventory ?? v.maxInventory ?? null,
                  sortOrder: v.sortOrder ?? i,
                  isActive: v.isActive ?? true,
                },
              });
            }
          }
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      });
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
