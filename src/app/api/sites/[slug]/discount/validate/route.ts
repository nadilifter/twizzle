import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const validateSchema = z.object({
  code: z.string().min(1, "Discount code is required").toUpperCase(),
  amount: z.number().min(0).optional(),
});

/**
 * POST /api/sites/[slug]/discount/validate
 * Public endpoint to validate a discount code for site checkout.
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: params.slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json({ valid: false, error: "Site not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = validateSchema.parse(body);

    const discount = await db.discount.findFirst({
      where: { code: validatedData.code, organizationId: config.organizationId },
    });

    if (!discount) {
      return NextResponse.json({ valid: false, error: "Invalid discount code" }, { status: 400 });
    }

    const now = new Date();
    const validFrom = new Date(discount.validFrom);
    const validTo = discount.validTo ? new Date(discount.validTo) : null;

    if (discount.status === "DRAFT") {
      return NextResponse.json(
        { valid: false, error: "This discount code is not yet active" },
        { status: 400 }
      );
    }

    if (validFrom > now) {
      return NextResponse.json(
        { valid: false, error: "This discount code is not yet valid" },
        { status: 400 }
      );
    }

    if (validTo && validTo < now) {
      return NextResponse.json(
        { valid: false, error: "This discount code has expired" },
        { status: 400 }
      );
    }

    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return NextResponse.json(
        { valid: false, error: "This discount code has reached its usage limit" },
        { status: 400 }
      );
    }

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
                : `$${Number(discount.amount).toFixed(2)} off`,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ valid: false, error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error validating discount:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate discount" },
      { status: 500 }
    );
  }
}
