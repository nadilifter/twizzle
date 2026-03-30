import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateBulkDiscountSchema = z.object({
  minQuantity: z.number().int().min(1).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
  discountValue: z.number().min(0).optional(),
  description: z.string().optional().nullable(),
});

// PUT /api/programs/[id]/bulk-discounts/[discountId] - Update a bulk discount
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; discountId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("programs.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, discountId } = await params;

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Verify discount exists
    const existingDiscount = await db.programBulkDiscount.findFirst({
      where: { id: discountId, programId },
    });

    if (!existingDiscount) {
      return NextResponse.json({ error: "Bulk discount not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateBulkDiscountSchema.parse(body);

    // Validate percentage discounts don't exceed 100%
    if (
      validatedData.discountType === "PERCENTAGE" &&
      validatedData.discountValue !== undefined &&
      validatedData.discountValue > 100
    ) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 }
      );
    }

    const bulkDiscount = await db.programBulkDiscount.update({
      where: { id: discountId },
      data: {
        ...(validatedData.minQuantity !== undefined && { minQuantity: validatedData.minQuantity }),
        ...(validatedData.discountType !== undefined && {
          discountType: validatedData.discountType,
        }),
        ...(validatedData.discountValue !== undefined && {
          discountValue: validatedData.discountValue,
        }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
      },
    });

    return NextResponse.json(bulkDiscount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating bulk discount:", error);
    return NextResponse.json({ error: "Failed to update bulk discount" }, { status: 500 });
  }
}

// DELETE /api/programs/[id]/bulk-discounts/[discountId] - Delete a bulk discount
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; discountId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("programs.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, discountId } = await params;

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Verify discount exists
    const existingDiscount = await db.programBulkDiscount.findFirst({
      where: { id: discountId, programId },
    });

    if (!existingDiscount) {
      return NextResponse.json({ error: "Bulk discount not found" }, { status: 404 });
    }

    await db.programBulkDiscount.delete({ where: { id: discountId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bulk discount:", error);
    return NextResponse.json({ error: "Failed to delete bulk discount" }, { status: 500 });
  }
}
