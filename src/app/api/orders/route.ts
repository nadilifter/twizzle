import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";

// GET /api/orders - List orders for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const blocked = await checkFeatureGate(session.user.organizationId, "store");
    if (blocked) return blocked;

    const scopedDb = getScopedDb(session.user.organizationId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.fulfillmentStatus = status;
    }

    if (source && source !== "all") {
      where.source = source;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { invoice: { reference: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      scopedDb.order.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              reference: true,
              subtotal: true,
              tax: true,
              total: true,
              status: true,
              lineItems: {
                where: { productId: { not: null } },
                select: {
                  id: true,
                  description: true,
                  quantity: true,
                  unitPrice: true,
                  total: true,
                  productId: true,
                  productVariantId: true,
                  productVariant: {
                    select: { id: true, label: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.order.count({ where }),
    ]);

    return NextResponse.json({ data: orders, total, limit, offset });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
