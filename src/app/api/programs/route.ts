import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  level: z.string().min(1, "Level is required"), // Legacy field
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  // New fields
  programType: z.enum(["SINGLE_INSTANCE", "SUBSCRIPTION", "DROP_IN"]).default("SUBSCRIPTION"),
  pricingModel: z.enum(["FLAT_RATE", "PER_SESSION"]).default("FLAT_RATE"),
  basePrice: z.number().min(0).optional().nullable(),
  perSessionPrice: z.number().min(0).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  schedulePattern: z.any().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  levelId: z.string().optional().nullable(),
  showLevelOnSite: z.boolean().default(true),
  showCoachOnSite: z.boolean().default(true),
});

// GET /api/programs
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const scopedDb = getScopedDb(session.user.organizationId);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as "ACTIVE" | "INACTIVE" | "ARCHIVED" }),
    };

    const [programs, total] = await Promise.all([
      scopedDb.program.findMany({
        where,
        include: {
          _count: {
            select: {
              enrollments: true,
              events: true,
              lessonPlans: true,
            },
          },
          membershipTiers: true,
          programLevel: true,
          bulkDiscounts: {
            orderBy: [{ type: "asc" }, { minQuantity: "asc" }],
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.program.count({ where }),
    ]);

    return NextResponse.json({
      data: programs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching programs:", error);
    return NextResponse.json(
      { error: "Failed to fetch programs" },
      { status: 500 }
    );
  }
}

// POST /api/programs
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createProgramSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const program = await scopedDb.program.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        level: validatedData.level,
        status: validatedData.status,
        programType: validatedData.programType,
        pricingModel: validatedData.pricingModel,
        basePrice: validatedData.basePrice,
        perSessionPrice: validatedData.perSessionPrice,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        schedulePattern: validatedData.schedulePattern,
        capacity: validatedData.capacity,
        levelId: validatedData.levelId,
        showLevelOnSite: validatedData.showLevelOnSite,
        showCoachOnSite: validatedData.showCoachOnSite,
      },
      include: {
        membershipTiers: true,
        programLevel: true,
        bulkDiscounts: true,
        _count: {
          select: {
            enrollments: true,
            events: true,
            lessonPlans: true,
          },
        },
      },
    });

    return NextResponse.json(program);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating program:", error);
    return NextResponse.json(
      { error: "Failed to create program" },
      { status: 500 }
    );
  }
}
