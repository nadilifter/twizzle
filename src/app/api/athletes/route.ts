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
        message: "Please select an organization first",
      });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const level = searchParams.get("level");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const orgId = session.user.organizationId;
    const orgAthleteFilter: Record<string, unknown> = { organizationId: orgId };
    if (status) orgAthleteFilter.status = status as "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED";
    if (level) orgAthleteFilter.level = level;

    const where = {
      organizationAthletes: {
        some: orgAthleteFilter,
      },
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const now = new Date();

    const [athletes, total] = await Promise.all([
      db.athlete.findMany({
        where,
        include: {
          organizationAthletes: {
            where: { organizationId: orgId },
            select: { level: true, status: true, customId: true },
          },
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
            select: {
              id: true,
              instance: {
                select: {
                  id: true,
                  name: true,
                  group: { select: { id: true, name: true } },
                },
              },
            },
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
      const orgAthlete = athlete.organizationAthletes[0];

      const enrollmentsWithFutureInstances = athlete.enrollments.filter(
        (e) => e.program.instances.length > 0
      );
      const programsWithFutureInstances = new Set(
        enrollmentsWithFutureInstances.map((e) => e.program.id)
      );
      const activeProgramList = Array.from(
        new Map(
          enrollmentsWithFutureInstances.map((e) => [
            e.program.id,
            { id: e.program.id, name: e.program.name },
          ])
        ).values()
      );

      const activeMembershipGroupList = Array.from(
        new Map(
          athlete.memberships
            .filter((m) => m.instance?.group)
            .map((m) => [
              m.instance.group.id,
              { id: m.instance.group.id, name: m.instance.group.name },
            ])
        ).values()
      );

      const uniqueCompetitionIds = new Set(athlete.competitionEntries.map((e) => e.competitionId));

      const { organizationAthletes: _oa, memberships: _m, ...rest } = athlete;
      return {
        ...rest,
        level: orgAthlete?.level ?? "Unassigned",
        status: orgAthlete?.status ?? "ACTIVE",
        customId: orgAthlete?.customId ?? null,
        parent: guardianUser?.name ?? "Unknown",
        activePrograms: programsWithFutureInstances.size,
        activeProgramList,
        activeMemberships: athlete.memberships.length,
        activeMembershipGroupList,
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
    return NextResponse.json({ error: "Failed to fetch athletes" }, { status: 500 });
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
      return NextResponse.json({ error: "Please select an organization first" }, { status: 400 });
    }

    // Super admins bypass permission checks
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin && !permissions.includes("*") && !permissions.includes("athletes.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createAthleteSchema.parse(body);

    // Verify the guardian user exists
    const guardianUser = await db.user.findUnique({
      where: { id: validatedData.guardianUserId },
    });

    if (!guardianUser) {
      return NextResponse.json({ error: "Guardian user not found" }, { status: 404 });
    }

    const athlete = await db.athlete.create({
      data: {
        name: validatedData.name,
        email: validatedData.email ?? null,
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
            level: validatedData.level,
            status: validatedData.status,
          },
        },
      },
      include: {
        organizationAthletes: {
          where: { organizationId: session.user.organizationId },
          select: { level: true, status: true, customId: true },
        },
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
    const orgAthlete = athlete.organizationAthletes[0];

    const { organizationAthletes: _oa, ...athleteRest } = athlete;
    const transformedAthlete = {
      ...athleteRest,
      level: orgAthlete?.level ?? "Unassigned",
      status: orgAthlete?.status ?? "ACTIVE",
      customId: orgAthlete?.customId ?? null,
      parent: guardianUserData?.name ?? "Unknown",
      activePrograms: 0,
      activeProgramList: [],
      activeMemberships: 0,
      activeMembershipGroupList: [],
      upcomingCompetitions: 0,
    };

    return NextResponse.json(transformedAthlete);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    // Log detailed error for debugging
    console.error("Error creating athlete:", error);
    return NextResponse.json({ error: "Failed to create athlete" }, { status: 500 });
  }
}
