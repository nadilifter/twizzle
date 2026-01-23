import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateDiscountSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).toUpperCase().optional(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
  amount: z.number().min(0).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional().nullable(),
  userScope: z.enum(["ALL", "NEW_USERS", "MEMBERS", "VIP"]).optional(),
  productScope: z.enum(["ALL", "MERCHANDISE", "EVENTS", "MEMBERSHIP"]).optional(),
  usageLimit: z.number().int().positive().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "SCHEDULED", "DRAFT"]).optional(),
});

// GET /api/discounts/[id] - Get a specific discount
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    const discount = await db.discount.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            invoice: {
              select: {
                id: true,
                reference: true,
                status: true,
                family: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            athlete: {
              select: {
                id: true,
                name: true,
              },
            },
            program: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            lineItems: true,
          },
        },
      },
    });

    if (!discount) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    // Compute current effective status
    const now = new Date();
    const validFrom = new Date(discount.validFrom);
    const validTo = discount.validTo ? new Date(discount.validTo) : null;

    let computedStatus = discount.status;
    if (discount.status !== "DRAFT") {
      if (validTo && validTo < now) {
        computedStatus = "EXPIRED";
      } else if (validFrom > now) {
        computedStatus = "SCHEDULED";
      } else if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        computedStatus = "EXPIRED";
      } else {
        computedStatus = "ACTIVE";
      }
    }

    // Calculate total savings from this discount
    const totalSavings = discount.lineItems.reduce((sum, item) => {
      // For line items with this discount, calculate the discount amount
      if (discount.type === "PERCENTAGE") {
        return sum + (Number(item.unitPrice) * item.quantity * discount.amount.toNumber() / 100);
      } else {
        return sum + discount.amount.toNumber();
      }
    }, 0);

    return NextResponse.json({
      ...discount,
      computedStatus,
      usageRemaining: discount.usageLimit ? discount.usageLimit - discount.usageCount : null,
      timesUsed: discount._count.lineItems,
      totalSavings,
    });
  } catch (error) {
    console.error("Error fetching discount:", error);
    return NextResponse.json(
      { error: "Failed to fetch discount" },
      { status: 500 }
    );
  }
}

// PATCH /api/discounts/[id] - Update a discount
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateDiscountSchema.parse(body);

    const existing = await db.discount.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    // If changing code, check for uniqueness
    if (validatedData.code && validatedData.code !== existing.code) {
      const existingWithCode = await db.discount.findUnique({
        where: { code: validatedData.code },
      });
      if (existingWithCode) {
        return NextResponse.json(
          { error: "A discount with this code already exists" },
          { status: 400 }
        );
      }
    }

    // Validate percentage type (max 100%)
    if (validatedData.type === "PERCENTAGE" && validatedData.amount && validatedData.amount > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.code !== undefined) updateData.code = validatedData.code;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;
    if (validatedData.validFrom !== undefined) updateData.validFrom = new Date(validatedData.validFrom);
    if (validatedData.validTo !== undefined) updateData.validTo = validatedData.validTo ? new Date(validatedData.validTo) : null;
    if (validatedData.userScope !== undefined) updateData.userScope = validatedData.userScope;
    if (validatedData.productScope !== undefined) updateData.productScope = validatedData.productScope;
    if (validatedData.usageLimit !== undefined) updateData.usageLimit = validatedData.usageLimit;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;

    const discount = await db.discount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(discount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating discount:", error);
    return NextResponse.json(
      { error: "Failed to update discount" },
      { status: 500 }
    );
  }
}

// DELETE /api/discounts/[id] - Delete a discount
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.discount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            lineItems: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    // Prevent deletion of discounts that have been used
    if (existing._count.lineItems > 0) {
      return NextResponse.json(
        { error: "Cannot delete a discount that has been used. Set it to expired instead." },
        { status: 400 }
      );
    }

    await db.discount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting discount:", error);
    return NextResponse.json(
      { error: "Failed to delete discount" },
      { status: 500 }
    );
  }
}
