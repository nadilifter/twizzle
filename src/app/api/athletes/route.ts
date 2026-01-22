import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createAthleteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable(),
  level: z.string().min(1, "Level is required"),
  group: z.string().min(1, "Group is required"),
  status: z.enum(["ACTIVE", "INACTIVE", "TRIAL", "GRADUATED"]).default("ACTIVE"),
  birthDate: z.string().optional().nullable(),
  familyId: z.string().min(1, "Family is required"),
});

// GET /api/athletes - List athletes for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const level = searchParams.get("level");
    const group = searchParams.get("group");
    const familyId = searchParams.get("familyId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      family: {
        organizationId: session.user.organizationId,
      },
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED" }),
      ...(level && { level }),
      ...(group && { group }),
      ...(familyId && { familyId }),
    };

    const [athletes, total] = await Promise.all([
      db.athlete.findMany({
        where,
        include: {
          family: {
            select: {
              id: true,
              name: true,
              email: true,
              primaryContact: true,
            },
          },
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              program: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                },
              },
            },
          },
          _count: {
            select: {
              attendances: true,
              evaluations: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      db.athlete.count({ where }),
    ]);

    // Transform for frontend compatibility
    const transformedAthletes = athletes.map((athlete) => ({
      ...athlete,
      status: athlete.status.toLowerCase(),
      parent: athlete.family.primaryContact,
    }));

    return NextResponse.json({
      data: transformedAthletes,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching athletes:", error);
    return NextResponse.json(
      { error: "Failed to fetch athletes" },
      { status: 500 }
    );
  }
}

// POST /api/athletes - Create a new athlete
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("athletes.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createAthleteSchema.parse(body);

    // Verify family belongs to the organization
    const family = await db.family.findFirst({
      where: {
        id: validatedData.familyId,
        organizationId: session.user.organizationId,
      },
    });

    if (!family) {
      return NextResponse.json(
        { error: "Family not found" },
        { status: 404 }
      );
    }

    const athlete = await db.athlete.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        level: validatedData.level,
        group: validatedData.group,
        status: validatedData.status,
        birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : null,
        familyId: validatedData.familyId,
      },
      include: {
        family: true,
        enrollments: {
          include: {
            program: true,
          },
        },
      },
    });

    return NextResponse.json(athlete);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating athlete:", error);
    return NextResponse.json(
      { error: "Failed to create athlete" },
      { status: 500 }
    );
  }
}
