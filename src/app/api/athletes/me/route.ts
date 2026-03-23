import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";

/**
 * GET /api/athletes/me
 *
 * Returns athletes for the current user via guardian links + self-athletes.
 * For each athlete, includes basic info, isSelf, guardianCount, organizations, registrationCount.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Support superadmin impersonation: use viewingAsUserId if set
    const userId = (session.user.isSuperAdmin && session.user.viewingAsUserId)
      ? session.user.viewingAsUserId
      : session.user.id;

    // Find athletes via User-based AthleteGuardian links
    const athleteSelect = {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      avatar: true,
      birthDate: true,
      gender: true,
      allowGuardianClaims: true,
      userId: true,
      organizationAthletes: {
        select: {
          level: true,
          status: true,
          organization: { select: { name: true } },
        },
      },
      _count: {
        select: {
          guardians: true,
          enrollments: true,
          instanceRegistrations: true,
          competitionEntries: true,
        },
      },
      enrollments: {
        select: {
          program: { select: { organization: { select: { name: true } } } },
        },
      },
      instanceRegistrations: {
        select: {
          programInstance: {
            select: { organization: { select: { name: true } } },
          },
        },
      },
      competitionEntries: {
        select: {
          competition: {
            select: { organization: { select: { name: true } } },
          },
        },
      },
    } as const;

    const userGuardianLinks = await db.athleteGuardian.findMany({
      where: { userId },
      include: {
        athlete: { select: athleteSelect },
      },
    });

    // Find self-athletes (athlete.userId === session user)
    const selfAthletes = await db.athlete.findMany({
      where: { userId },
      select: athleteSelect,
    });

    // Deduplicate athletes
    const athleteMap = new Map<string, (typeof userGuardianLinks)[0]["athlete"]>();
    for (const link of userGuardianLinks) {
      athleteMap.set(link.athlete.id, link.athlete);
    }
    for (const a of selfAthletes) {
      athleteMap.set(a.id, a);
    }

    const athletes = Array.from(athleteMap.values()).map((a) => {
      const orgNames = new Set<string>();
      for (const oa of a.organizationAthletes ?? []) {
        if (oa.organization?.name) orgNames.add(oa.organization.name);
      }
      for (const e of a.enrollments ?? []) {
        if (e.program?.organization?.name) orgNames.add(e.program.organization.name);
      }
      for (const ir of a.instanceRegistrations ?? []) {
        if (ir.programInstance?.organization?.name)
          orgNames.add(ir.programInstance.organization.name);
      }
      for (const ce of a.competitionEntries ?? []) {
        if (ce.competition?.organization?.name)
          orgNames.add(ce.competition.organization.name);
      }

      const c = a._count;
      const registrationCount =
        (c?.enrollments ?? 0) +
        (c?.instanceRegistrations ?? 0) +
        (c?.competitionEntries ?? 0);

      // Use the first org-athlete link for portal-level status/level display
      const primaryOa = a.organizationAthletes?.[0];

      return {
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        name: a.name,
        birthDate: a.birthDate,
        gender: a.gender,
        status: primaryOa?.status ?? "ACTIVE",
        level: primaryOa?.level ?? "Unassigned",
        allowGuardianClaims: a.allowGuardianClaims,
        isSelf: a.userId === userId,
        guardianCount: c?.guardians ?? 0,
        organizations: Array.from(orgNames),
        registrationCount,
      };
    });

    return NextResponse.json({ athletes });
  } catch (error) {
    console.error("GET /api/athletes/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch athletes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/athletes/me
 *
 * Create a new athlete for the current user (athlete portal context).
 * No organization context required — athlete is linked to the user as guardian.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { firstName, lastName, birthDate, gender, isSelf, allowGuardianClaims } = body;

    if (!firstName || !lastName || !birthDate || !gender) {
      return NextResponse.json(
        { error: "firstName, lastName, birthDate, and gender are required" },
        { status: 400 }
      );
    }

    const validGenders = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];
    if (!validGenders.includes(gender)) {
      return NextResponse.json(
        { error: "Invalid gender value" },
        { status: 400 }
      );
    }

    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, avatar: true },
    });
    if (!currentUser) {
      return NextResponse.json(
        { error: "Your user account was not found. Please sign out and sign back in." },
        { status: 401 }
      );
    }

    // Duplicate detection: check if user already has a matching athlete
    const parsedBirthDate = parseDateOnly(birthDate)!;
    const startOfDay = new Date(parsedBirthDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedBirthDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAthlete = await db.athlete.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
        birthDate: { gte: startOfDay, lte: endOfDay },
        OR: [
          { guardians: { some: { userId } } },
          { userId },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (existingAthlete) {
      return NextResponse.json(
        { error: "You already have an athlete with this name and date of birth." },
        { status: 409 }
      );
    }

    if (isSelf) {
      const existingSelf = await db.athlete.findUnique({ where: { userId } });
      if (existingSelf) {
        return NextResponse.json(
          { error: "You already have a self-athlete profile." },
          { status: 409 }
        );
      }
    }

    const athlete = await db.athlete.create({
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        birthDate: parsedBirthDate,
        gender,
        userId: isSelf ? userId : undefined,
        ...(isSelf && {
          email: currentUser.email,
          avatar: currentUser.avatar,
        }),
        allowGuardianClaims: isSelf ? false : (allowGuardianClaims ?? false),
        guardians: {
          create: {
            userId,
            relationship: isSelf ? "Self" : "Parent",
            isPrimary: true,
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        birthDate: true,
        gender: true,
        allowGuardianClaims: true,
        userId: true,
      },
    });

    return NextResponse.json({ athlete }, { status: 201 });
  } catch (error) {
    console.error("POST /api/athletes/me error:", error);
    return NextResponse.json(
      { error: "Failed to create athlete" },
      { status: 500 }
    );
  }
}
