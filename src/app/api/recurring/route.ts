import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { parseDateOnly, normalizeToNoonUTC } from "@/lib/date-utils";
import { executeRecurringCharge } from "@/lib/recurring-billing-service";
import { addMonths, addYears } from "date-fns";
import { z } from "zod";

const createRecurringChargeSchema = z.object({
  userId: z.string().optional(),
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
    const userId = searchParams.get("userId");
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
        { athlete: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (athleteId) {
      where.athleteId = athleteId;
    }

    const [charges, total] = await Promise.all([
      db.recurringCharge.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          athlete: {
            select: {
              id: true,
              name: true,
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
          athletePass: {
            select: { id: true, pass: { select: { name: true } } },
          },
          athleteMembership: {
            select: {
              id: true,
              instance: { select: { group: { select: { name: true } } } },
            },
          },
          enrollment: {
            select: { id: true, program: { select: { name: true } } },
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

    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const [dueToday, activeStats, failedStats, upcomingWeek] = await Promise.all([
      db.recurringCharge.aggregate({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
          nextChargeDate: { gte: today, lte: endOfDay },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.recurringCharge.aggregate({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.recurringCharge.count({
        where: {
          organizationId: session.user.organizationId,
          status: "FAILED",
        },
      }),
      db.recurringCharge.aggregate({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
          nextChargeDate: { gte: today, lte: weekFromNow },
        },
        _sum: { amount: true },
        _count: true,
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
        upcomingWeekAmount: upcomingWeek._sum.amount || 0,
        upcomingWeekCount: upcomingWeek._count || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching recurring charges:", error);
    return NextResponse.json({ error: "Failed to fetch recurring charges" }, { status: 500 });
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

    const userId = validatedData.userId ?? session.user.id;

    if (!userId) {
      return NextResponse.json({ error: "User is required" }, { status: 400 });
    }

    // Verify athlete if provided
    if (validatedData.athleteId) {
      const athlete = await db.athlete.findFirst({
        where: {
          id: validatedData.athleteId,
          organizationAthletes: {
            some: { organizationId: session.user.organizationId },
          },
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
          userId,
        },
      });

      if (!paymentMethod) {
        return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
      }
    }

    const charge = await db.recurringCharge.create({
      data: {
        organizationId: session.user.organizationId,
        userId: userId ?? undefined,
        athleteId: validatedData.athleteId,
        description: validatedData.description,
        amount: validatedData.amount,
        frequency: validatedData.frequency,
        nextChargeDate: parseDateOnly(validatedData.nextChargeDate)!,
        paymentMethodId: validatedData.paymentMethodId,
        status: validatedData.status,
      },
      include: {
        athlete: true,
        paymentMethod: true,
      },
    });

    return NextResponse.json(charge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating recurring charge:", error);
    return NextResponse.json({ error: "Failed to create recurring charge" }, { status: 500 });
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
    const scopedDb = getScopedDb(session.user.organizationId);

    // If running a batch
    if (body.action === "run_batch") {
      const now = new Date();
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const MIN_RETRY_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20 hours

      const dueCharges = await db.recurringCharge.findMany({
        where: {
          organizationId: session.user.organizationId,
          organization: { isActive: true },
          status: "ACTIVE",
          nextChargeDate: { lte: todayEnd },
        },
        include: {
          paymentMethod: {
            select: {
              id: true,
              type: true,
              last4: true,
              brand: true,
              adyenTokenId: true,
              shopperReference: true,
            },
          },
        },
      });

      const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
      };

      for (const charge of dueCharges) {
        if (!charge.paymentMethodId || !charge.paymentMethod) {
          results.skipped++;
          continue;
        }

        if (!charge.paymentMethod.adyenTokenId) {
          results.skipped++;
          continue;
        }

        if (charge.lastAttemptAt) {
          const timeSinceLastAttempt = now.getTime() - charge.lastAttemptAt.getTime();
          if (timeSinceLastAttempt < MIN_RETRY_INTERVAL_MS) {
            results.skipped++;
            continue;
          }
        }

        try {
          await db.recurringCharge.update({
            where: { id: charge.id },
            data: { lastAttemptAt: now },
          });

          const result = await executeRecurringCharge(charge, charge.organizationId);

          if (result.success) {
            const nextDate =
              charge.frequency === "YEARLY"
                ? normalizeToNoonUTC(addYears(charge.nextChargeDate, 1))!
                : normalizeToNoonUTC(addMonths(charge.nextChargeDate, 1))!;

            await scopedDb.recurringCharge.update({
              where: { id: charge.id },
              data: {
                nextChargeDate: nextDate,
                lastChargedAt: now,
                failureCount: 0,
              },
            });

            results.processed++;
          } else {
            const newFailureCount = charge.failureCount + 1;
            const MAX_RETRIES = 3;

            await scopedDb.recurringCharge.update({
              where: { id: charge.id },
              data: {
                failureCount: newFailureCount,
                status: newFailureCount >= MAX_RETRIES ? "FAILED" : "ACTIVE",
              },
            });

            results.failed++;
          }
        } catch (error) {
          console.error(`Error processing recurring charge ${charge.id}:`, error);
          results.failed++;
        }
      }

      return NextResponse.json({
        message: "Batch processed",
        results,
      });
    }

    // Single charge update
    if (body.id) {
      const validatedData = updateRecurringChargeSchema.parse(body);

      const charge = await scopedDb.recurringCharge.update({
        where: { id: body.id },
        data: {
          ...(validatedData.description && { description: validatedData.description }),
          ...(validatedData.amount && { amount: validatedData.amount }),
          ...(validatedData.frequency && { frequency: validatedData.frequency }),
          ...(validatedData.nextChargeDate && {
            nextChargeDate: parseDateOnly(validatedData.nextChargeDate)!,
          }),
          ...(validatedData.paymentMethodId !== undefined && {
            paymentMethodId: validatedData.paymentMethodId,
          }),
          ...(validatedData.status && { status: validatedData.status }),
        },
        include: {
          athlete: true,
          paymentMethod: true,
        },
      });

      return NextResponse.json(charge);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating recurring charge:", error);
    return NextResponse.json({ error: "Failed to update recurring charge" }, { status: 500 });
  }
}
