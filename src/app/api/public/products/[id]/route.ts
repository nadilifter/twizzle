import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";
import { isFeatureEnabled } from "@/lib/feature-resolver";

// GET /api/public/products/[id] - Get a single active product for the public storefront
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    const storeEnabled = await isFeatureEnabled(organizationId, "store");
    if (!storeEnabled) {
      return NextResponse.json({ error: "Store not enabled" }, { status: 404 });
    }

    const product = await db.product.findFirst({
      where: { id, organizationId, isActive: true },
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
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ data: product });
  } catch (error) {
    console.error("Error fetching public product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
