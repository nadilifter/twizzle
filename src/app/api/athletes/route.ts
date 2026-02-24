import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const createAthleteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable(),
  level: z.string().min(1, "Level is required"),
  status: z.enum(["ACTIVE", "INACTIVE", "TRIAL", "GRADUATED"]).default("ACTIVE"),
  birthDate: z.string().optional().nullable(),
  guardianUserId: z.string().min(1, "Guardian is required"),
});

// GET /api/athletes - List athletes for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require an organization to be selected
    if (!session.user.organizationId) {
      return NextResponse.json({
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
        message: "Please select an organization first"
      });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const level = searchParams.get("level");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      organizationAthletes: {
        some: { organizationId: session.user.organizationId },
      },
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED" }),
      ...(level && { level }),
    };

    const now = new Date();

    const [athletes, total] = await Promise.all([
      db.athlete.findMany({
        where,
        include: {
          guardians: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              program: {
                select: {
                  id: true,
                  name: true,
                  instances: {
                    where: { date: { gte: now }, status: "SCHEDULED" },
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
          memberships: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
          competitionEntries: {
            where: {
              status: { notIn: ["WITHDRAWN", "SCRATCHED", "REJECTED"] },
              competition: { endDate: { gte: now } },
            },
            select: { competitionId: true },
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

    const transformedAthletes = athletes.map((athlete) => {
      const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) || athlete.guardians[0];
      const guardianUser = primaryGuardian?.user ?? null;

      const programsWithFutureInstances = new Set(
        athlete.enrollments
          .filter((e) => e.program.instances.length > 0)
          .map((e) => e.program.id)
      );

      const uniqueCompetitionIds = new Set(
        athlete.competitionEntries.map((e) => e.competitionId)
      );
      
      return {
        ...athlete,
        parent: guardianUser?.name ?? "Unknown",
        activePrograms: programsWithFutureInstances.size,
        activeMemberships: athlete.memberships.length,
        upcomingCompetitions: uniqueCompetitionIds.size,
      };
    });

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

    // Require an organization to be selected
    if (!session.user.organizationId) {
      return NextResponse.json(
        { error: "Please select an organization first" },
        { status: 400 }
      );
    }

    // Super admins bypass permission checks
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("athletes.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createAthleteSchema.parse(body);

    // Verify the guardian user exists
    const guardianUser = await db.user.findUnique({
      where: { id: validatedData.guardianUserId },
    });

    if (!guardianUser) {
      return NextResponse.json(
        { error: "Guardian user not found" },
        { status: 404 }
      );
    }

    const athlete = await db.athlete.create({
      data: {
        name: validatedData.name,
        email: validatedData.email ?? null,
        level: validatedData.level,
        status: validatedData.status,
        organizationId: session.user.organizationId,
        birthDate: parseDateOnly(validatedData.birthDate),
        guardians: {
          create: {
            userId: validatedData.guardianUserId,
            relationship: "Primary",
            isPrimary: true,
          },
        },
        organizationAthletes: {
          create: {
            organizationId: session.user.organizationId!,
          },
        },
      },
      include: {
        guardians: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            program: {
              select: {
                id: true,
                name: true,
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
    });

    const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) || athlete.guardians[0];
    const guardianUserData = primaryGuardian?.user ?? null;

    const transformedAthlete = {
      ...athlete,
      parent: guardianUserData?.name ?? "Unknown",
      activePrograms: 0,
      activeMemberships: 0,
      upcomingCompetitions: 0,
    };

    return NextResponse.json(transformedAthlete);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    // Log detailed error for debugging
    console.error("Error creating athlete:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create athlete";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
