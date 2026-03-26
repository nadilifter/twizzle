import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const createSeasonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().default("#8b5cf6"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
  isRecurring: z.boolean().default(false),
  renewalLeadDays: z.number().int().min(1).default(30),
});

// GET /api/seasons
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const scopedDb = getScopedDb(session.user.organizationId);

    const where: Prisma.SeasonWhereInput = {};
    if (status) {
      where.status = status as Prisma.EnumSeasonStatusFilter;
    }
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [seasons, total] = await Promise.all([
      scopedDb.season.findMany({
        where,
        include: {
          _count: {
            select: {
              programs: true,
              memberships: true,
              competitions: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.season.count({ where }),
    ]);

    return NextResponse.json({ data: seasons, total, limit, offset });
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json(
      { error: "Failed to fetch seasons" },
      { status: 500 }
    );
  }
}

// POST /api/seasons
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const body = await request.json();
    const validatedData = createSeasonSchema.parse(body);

    const startDate = parseDateOnly(validatedData.startDate);
    const endDate = parseDateOnly(validatedData.endDate);

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    const scopedDb = getScopedDb(session.user.organizationId);

    const season = await scopedDb.season.create({
      data: {
        organizationId: session.user.organizationId!,
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        startDate,
        endDate,
        status: validatedData.status,
        isRecurring: validatedData.isRecurring,
        renewalLeadDays: validatedData.renewalLeadDays,
      },
      include: {
        _count: {
          select: {
            programs: true,
            memberships: true,
            competitions: true,
          },
        },
      },
    });

    return NextResponse.json(season);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating season:", error);
    return NextResponse.json(
      { error: "Failed to create season" },
      { status: 500 }
    );
  }
}
