import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const validateDiscountSchema = z.object({
  code: z.string().min(1, "Discount code is required").toUpperCase(),
  productScope: z.enum(["ALL", "MERCHANDISE", "EVENTS", "MEMBERSHIP"]).optional(),
  amount: z.number().min(0).optional(), // The order/invoice amount to calculate discount
});

// POST /api/discounts/validate - Validate and calculate a discount code
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = validateDiscountSchema.parse(body);

    const discount = await db.discount.findFirst({
      where: { code: validatedData.code, organizationId: session.user.organizationId },
    });

    if (!discount) {
      return NextResponse.json(
        { valid: false, error: "Invalid discount code" },
        { status: 400 }
      );
    }

    const now = new Date();
    const validFrom = new Date(discount.validFrom);
    const validTo = discount.validTo ? new Date(discount.validTo) : null;

    // Check if discount is in draft status
    if (discount.status === "DRAFT") {
      return NextResponse.json(
        { valid: false, error: "This discount code is not yet active" },
        { status: 400 }
      );
    }

    // Check if discount has started
    if (validFrom > now) {
      return NextResponse.json(
        { valid: false, error: "This discount code is not yet valid" },
        { status: 400 }
      );
    }

    // Check if discount has expired
    if (validTo && validTo < now) {
      return NextResponse.json(
        { valid: false, error: "This discount code has expired" },
        { status: 400 }
      );
    }

    // Check usage limit
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return NextResponse.json(
        { valid: false, error: "This discount code has reached its usage limit" },
        { status: 400 }
      );
    }

    // Check product scope compatibility
    if (
      validatedData.productScope &&
      discount.productScope !== "ALL" &&
      discount.productScope !== validatedData.productScope
    ) {
      return NextResponse.json(
        { 
          valid: false, 
          error: `This discount is only valid for ${discount.productScope.toLowerCase().replace("_", " ")} purchases` 
        },
        { status: 400 }
      );
    }

    // Calculate the discount amount if an order amount was provided
    let discountAmount = 0;
    let finalAmount = validatedData.amount || 0;

    if (validatedData.amount) {
      if (discount.type === "PERCENTAGE") {
        discountAmount = (validatedData.amount * Number(discount.amount)) / 100;
      } else {
        discountAmount = Math.min(Number(discount.amount), validatedData.amount);
      }
      finalAmount = validatedData.amount - discountAmount;
    }

    return NextResponse.json({
      valid: true,
      discount: {
        id: discount.id,
        name: discount.name,
        code: discount.code,
        type: discount.type,
        amount: Number(discount.amount),
        userScope: discount.userScope,
        productScope: discount.productScope,
      },
      calculation: validatedData.amount
        ? {
            originalAmount: validatedData.amount,
            discountAmount: Math.round(discountAmount * 100) / 100,
            finalAmount: Math.round(finalAmount * 100) / 100,
            discountDescription:
              discount.type === "PERCENTAGE"
                ? `${discount.amount}% off`
                : `$${discount.amount} off`,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { valid: false, error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error validating discount:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate discount" },
      { status: 500 }
    );
  }
}
