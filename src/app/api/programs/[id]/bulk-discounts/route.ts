import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createBulkDiscountSchema = z.object({
  type: z.enum(["FAMILY_SIBLING", "MULTI_SESSION"]),
  minQuantity: z.number().int().min(1, "Minimum quantity must be at least 1"),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().min(0, "Discount value must be positive"),
  description: z.string().optional().nullable(),
});

// GET /api/programs/[id]/bulk-discounts - List all bulk discounts for a program
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: programId } = await params;

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const bulkDiscounts = await db.programBulkDiscount.findMany({
      where: { programId },
      orderBy: [{ type: "asc" }, { minQuantity: "asc" }],
    });

    return NextResponse.json(bulkDiscounts);
  } catch (error) {
    console.error("Error fetching bulk discounts:", error);
    return NextResponse.json({ error: "Failed to fetch bulk discounts" }, { status: 500 });
  }
}

// POST /api/programs/[id]/bulk-discounts - Create a new bulk discount
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: programId } = await params;

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createBulkDiscountSchema.parse(body);

    // Validate percentage discounts don't exceed 100%
    if (validatedData.discountType === "PERCENTAGE" && validatedData.discountValue > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 }
      );
    }

    // Check for duplicate discount at same quantity for same type
    const existingDiscount = await db.programBulkDiscount.findFirst({
      where: {
        programId,
        type: validatedData.type,
        minQuantity: validatedData.minQuantity,
      },
    });

    if (existingDiscount) {
      return NextResponse.json(
        {
          error: `A ${validatedData.type} discount for quantity ${validatedData.minQuantity} already exists`,
        },
        { status: 400 }
      );
    }

    const bulkDiscount = await db.programBulkDiscount.create({
      data: {
        programId,
        type: validatedData.type,
        minQuantity: validatedData.minQuantity,
        discountType: validatedData.discountType,
        discountValue: validatedData.discountValue,
        description: validatedData.description,
      },
    });

    return NextResponse.json(bulkDiscount, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating bulk discount:", error);
    return NextResponse.json({ error: "Failed to create bulk discount" }, { status: 500 });
  }
}
