import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";
import { isFeatureEnabled } from "@/lib/feature-resolver";

// GET /api/public/products - List active products for a public storefront
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    const storeEnabled = await isFeatureEnabled(organizationId, "store");
    if (!storeEnabled) {
      return NextResponse.json({ data: [], categories: [] });
    }

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      organizationId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category && category !== "All") {
      where.category = category;
    }

    const products = await db.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        imageUrl: true,
        currentInventory: true,
        maxInventory: true,
        typeName: true,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            label: true,
            price: true,
            currentInventory: true,
            maxInventory: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const categories = [...new Set(products.map((p) => p.category))];

    return NextResponse.json({ data: products, categories });
  } catch (error) {
    console.error("Error fetching public products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
