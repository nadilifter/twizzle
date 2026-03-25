import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const variantSchema = z.object({
  label: z.string().min(1, "Variant label is required"),
  price: z.number().min(0).optional().nullable(),
  maxInventory: z.number().int().positive().optional().nullable(),
  currentInventory: z.number().int().min(0).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  category: z.string().default("General"),
  price: z.number().min(0, "Price must be positive"),
  imageUrl: z.string().optional().nullable(),
  maxInventory: z.number().int().positive().optional().nullable(),
  currentInventory: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  glCodeId: z.string().optional().nullable(),
  typeName: z.string().optional().nullable(),
  variants: z.array(variantSchema).optional(),
});

// GET /api/products - List products
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category && category !== "All") {
      where.category = category;
    }

    if (activeOnly) {
      where.isActive = true;
    }

    const [products, total] = await Promise.all([
      scopedDb.product.findMany({
        where,
        include: {
          variants: { orderBy: { sortOrder: "asc" } },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.product.count({ where }),
    ]);

    // Get unique categories for filtering
    const allProducts = await scopedDb.product.findMany({
      select: { category: true },
      distinct: ["category"],
    });
    const categories = Array.from(new Set(allProducts.map((p) => p.category))).sort();

    return NextResponse.json({
      data: products,
      total,
      limit,
      offset,
      categories,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
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
      !session.user.permissions?.includes("products.create") &&
      !session.user.permissions?.includes("financials.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    const body = await request.json();
    const validatedData = createProductSchema.parse(body);

    const hasVariants = !!validatedData.typeName;

    if (hasVariants && (!validatedData.variants || validatedData.variants.length === 0)) {
      return NextResponse.json(
        { error: "At least one variant option is required when a type is set" },
        { status: 400 }
      );
    }

    // Check if SKU already exists for this organization (if provided)
    if (validatedData.sku) {
      const existingProduct = await scopedDb.product.findFirst({
        where: { sku: validatedData.sku },
      });

      if (existingProduct) {
        return NextResponse.json(
          { error: "A product with this SKU already exists" },
          { status: 400 }
        );
      }
    }

    if (validatedData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: validatedData.glCodeId } });
      if (!glCode) {
        return NextResponse.json({ error: "GL code not found" }, { status: 404 });
      }
    }

    // When variants exist, inventory is managed at variant level
    const currentInventory = hasVariants ? null : (validatedData.currentInventory ?? validatedData.maxInventory);
    const maxInventory = hasVariants ? null : validatedData.maxInventory;

    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          organizationId: session.user.organizationId,
          name: validatedData.name,
          description: validatedData.description,
          sku: validatedData.sku,
          category: validatedData.category,
          price: validatedData.price,
          imageUrl: validatedData.imageUrl,
          maxInventory,
          currentInventory,
          typeName: hasVariants ? validatedData.typeName : null,
          isActive: validatedData.isActive,
          glCodeId: validatedData.glCodeId,
        },
      });

      if (hasVariants && validatedData.variants) {
        await tx.productVariant.createMany({
          data: validatedData.variants.map((v, i) => ({
            productId: created.id,
            label: v.label,
            price: v.price ?? null,
            maxInventory: v.maxInventory ?? null,
            currentInventory: v.currentInventory ?? v.maxInventory ?? null,
            sortOrder: v.sortOrder ?? i,
          })),
        });
      }

      return tx.product.findUnique({
        where: { id: created.id },
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
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
