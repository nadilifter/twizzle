import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createDiscountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").toUpperCase(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  amount: z.number().min(0, "Amount must be positive"),
  validFrom: z.string().min(1, "Start date is required"),
  validTo: z.string().optional().nullable(),
  userScope: z.enum(["ALL", "NEW_USERS", "MEMBERS", "VIP"]).default("ALL"),
  productScope: z.enum(["ALL", "MERCHANDISE", "EVENTS", "MEMBERSHIP"]).default("ALL"),
  usageLimit: z.number().int().positive().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "SCHEDULED", "DRAFT"]).default("DRAFT"),
});

// GET /api/discounts - List discounts
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const userScope = searchParams.get("userScope");
    const productScope = searchParams.get("productScope");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause - Discounts are global (not org-scoped) but could be in future
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (userScope) {
      where.userScope = userScope;
    }

    if (productScope) {
      where.productScope = productScope;
    }

    const [discounts, total] = await Promise.all([
      db.discount.findMany({
        where,
        include: {
          _count: {
            select: {
              lineItems: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.discount.count({ where }),
    ]);

    // Transform for frontend and add computed fields
    const now = new Date();
    const transformedDiscounts = discounts.map((discount) => {
      const validFrom = new Date(discount.validFrom);
      const validTo = discount.validTo ? new Date(discount.validTo) : null;

      // Compute active status
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

      return {
        ...discount,
        computedStatus,
        usageRemaining: discount.usageLimit ? discount.usageLimit - discount.usageCount : null,
        timesUsed: discount._count.lineItems,
      };
    });

    return NextResponse.json({
      data: transformedDiscounts,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching discounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch discounts" },
      { status: 500 }
    );
  }
}

// POST /api/discounts - Create a new discount
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createDiscountSchema.parse(body);

    // Check if code already exists
    const existingDiscount = await db.discount.findUnique({
      where: { code: validatedData.code },
    });

    if (existingDiscount) {
      return NextResponse.json(
        { error: "A discount with this code already exists" },
        { status: 400 }
      );
    }

    // Validate percentage type (max 100%)
    if (validatedData.type === "PERCENTAGE" && validatedData.amount > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 }
      );
    }

    const discount = await db.discount.create({
      data: {
        name: validatedData.name,
        code: validatedData.code,
        type: validatedData.type,
        amount: validatedData.amount,
        validFrom: new Date(validatedData.validFrom),
        validTo: validatedData.validTo ? new Date(validatedData.validTo) : null,
        userScope: validatedData.userScope,
        productScope: validatedData.productScope,
        usageLimit: validatedData.usageLimit,
        status: validatedData.status,
      },
    });

    return NextResponse.json(discount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating discount:", error);
    return NextResponse.json(
      { error: "Failed to create discount" },
      { status: 500 }
    );
  }
}
