import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const updateOrderSchema = z.object({
  fulfillmentStatus: z.enum(["PENDING", "FULFILLED", "CANCELLED"]),
  notes: z.string().optional(),
});

// PATCH /api/orders/[id] - Update order fulfillment status
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    const existing = await scopedDb.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateOrderSchema.parse(body);

    const updateData: Record<string, unknown> = {
      fulfillmentStatus: validatedData.fulfillmentStatus,
    };

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    if (validatedData.fulfillmentStatus === "FULFILLED") {
      updateData.fulfilledAt = new Date();
      updateData.fulfilledBy = session.user.id;
    }

    if (validatedData.fulfillmentStatus === "PENDING") {
      updateData.fulfilledAt = null;
      updateData.fulfilledBy = null;
    }

    const order = await scopedDb.order.update({
      where: { id },
      data: updateData,
      include: {
        invoice: {
          select: {
            id: true,
            reference: true,
            total: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

// GET /api/orders/[id] - Get a single order
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    const order = await scopedDb.order.findUnique({
      where: { id },
      include: {
        invoice: {
          select: {
            id: true,
            reference: true,
            subtotal: true,
            tax: true,
            total: true,
            status: true,
            createdAt: true,
            lineItems: {
              where: { productId: { not: null } },
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                total: true,
                productId: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
