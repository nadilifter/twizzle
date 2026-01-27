import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createRecurringChargeSchema = z.object({
  familyId: z.string().min(1, "Family is required"),
  athleteId: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  frequency: z.enum(["MONTHLY", "YEARLY", "SESSION"]),
  nextChargeDate: z.string().min(1, "Next charge date is required"),
  paymentMethodId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "FAILED"]).default("ACTIVE"),
});

const updateRecurringChargeSchema = z.object({
  description: z.string().optional(),
  amount: z.number().min(0.01).optional(),
  frequency: z.enum(["MONTHLY", "YEARLY", "SESSION"]).optional(),
  nextChargeDate: z.string().optional(),
  paymentMethodId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "FAILED"]).optional(),
});

// GET /api/recurring - List recurring charges
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const familyId = searchParams.get("familyId");
    const athleteId = searchParams.get("athleteId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { family: { name: { contains: search, mode: "insensitive" } } },
        { athlete: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (familyId) {
      where.familyId = familyId;
    }

    if (athleteId) {
      where.athleteId = athleteId;
    }

    const [charges, total] = await Promise.all([
      db.recurringCharge.findMany({
        where,
        include: {
          family: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          athlete: {
            select: {
              id: true,
              name: true,
              level: true,
            },
          },
          paymentMethod: {
            select: {
              id: true,
              type: true,
              last4: true,
              brand: true,
            },
          },
        },
        orderBy: { nextChargeDate: "asc" },
        take: limit,
        skip: offset,
      }),
      db.recurringCharge.count({ where }),
    ]);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [dueToday, activeStats, failedStats] = await Promise.all([
      // Charges due today
      db.recurringCharge.aggregate({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
          nextChargeDate: {
            gte: today,
            lte: endOfDay,
          },
        },
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      // All active charges
      db.recurringCharge.aggregate({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
        },
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      // Failed charges
      db.recurringCharge.count({
        where: {
          organizationId: session.user.organizationId,
          status: "FAILED",
        },
      }),
    ]);

    return NextResponse.json({
      data: charges,
      total,
      limit,
      offset,
      stats: {
        dueTodayAmount: dueToday._sum.amount || 0,
        dueTodayCount: dueToday._count || 0,
        activeAmount: activeStats._sum.amount || 0,
        activeCount: activeStats._count || 0,
        failedCount: failedStats,
      },
    });
  } catch (error) {
    console.error("Error fetching recurring charges:", error);
    return NextResponse.json(
      { error: "Failed to fetch recurring charges" },
      { status: 500 }
    );
  }
}

// POST /api/recurring - Create recurring charge
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
    const validatedData = createRecurringChargeSchema.parse(body);

    // Verify family exists
    const family = await db.family.findFirst({
      where: {
        id: validatedData.familyId,
        organizationId: session.user.organizationId,
      },
    });

    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify athlete if provided
    if (validatedData.athleteId) {
      const athlete = await db.athlete.findFirst({
        where: {
          id: validatedData.athleteId,
          organizationId: session.user.organizationId,
        },
      });

      if (!athlete) {
        return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
      }
    }

    // Verify payment method if provided
    if (validatedData.paymentMethodId) {
      const paymentMethod = await db.paymentMethod.findFirst({
        where: {
          id: validatedData.paymentMethodId,
          familyId: validatedData.familyId,
        },
      });

      if (!paymentMethod) {
        return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
      }
    }

    const charge = await db.recurringCharge.create({
      data: {
        organizationId: session.user.organizationId,
        familyId: validatedData.familyId,
        athleteId: validatedData.athleteId,
        description: validatedData.description,
        amount: validatedData.amount,
        frequency: validatedData.frequency,
        nextChargeDate: new Date(validatedData.nextChargeDate),
        paymentMethodId: validatedData.paymentMethodId,
        status: validatedData.status,
      },
      include: {
        family: true,
        athlete: true,
        paymentMethod: true,
      },
    });

    return NextResponse.json(charge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating recurring charge:", error);
    return NextResponse.json(
      { error: "Failed to create recurring charge" },
      { status: 500 }
    );
  }
}

// PATCH /api/recurring - Batch update recurring charges (e.g., run batch)
export async function PATCH(request: NextRequest) {
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

    // If running a batch
    if (body.action === "run_batch") {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Get all active charges due today or earlier
      const dueCharges = await db.recurringCharge.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
          nextChargeDate: {
            lte: today,
          },
        },
        include: {
          family: true,
          paymentMethod: true,
        },
      });

      const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
      };

      for (const charge of dueCharges) {
        // Skip if no payment method
        if (!charge.paymentMethodId) {
          results.skipped++;
          continue;
        }

        // In a real implementation, you would:
        // 1. Create a payment intent with Adyen
        // 2. Process the payment
        // 3. Create an invoice and payment record
        // 4. Update the recurring charge

        // For now, we'll just update the next charge date
        const nextDate = new Date(charge.nextChargeDate);
        if (charge.frequency === "MONTHLY") {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (charge.frequency === "YEARLY") {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }

        await db.recurringCharge.update({
          where: { id: charge.id },
          data: {
            nextChargeDate: nextDate,
            lastChargedAt: new Date(),
          },
        });

        results.processed++;
      }

      return NextResponse.json({
        message: "Batch processed",
        results,
      });
    }

    // Single charge update
    if (body.id) {
      const validatedData = updateRecurringChargeSchema.parse(body);

      const charge = await db.recurringCharge.update({
        where: {
          id: body.id,
          organizationId: session.user.organizationId,
        },
        data: {
          ...(validatedData.description && { description: validatedData.description }),
          ...(validatedData.amount && { amount: validatedData.amount }),
          ...(validatedData.frequency && { frequency: validatedData.frequency }),
          ...(validatedData.nextChargeDate && { nextChargeDate: new Date(validatedData.nextChargeDate) }),
          ...(validatedData.paymentMethodId !== undefined && { paymentMethodId: validatedData.paymentMethodId }),
          ...(validatedData.status && { status: validatedData.status }),
        },
        include: {
          family: true,
          athlete: true,
          paymentMethod: true,
        },
      });

      return NextResponse.json(charge);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating recurring charge:", error);
    return NextResponse.json(
      { error: "Failed to update recurring charge" },
      { status: 500 }
    );
  }
}
