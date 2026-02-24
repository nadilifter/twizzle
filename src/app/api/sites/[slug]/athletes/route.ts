import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/sites/[slug]/athletes
 *
 * Fetch ALL athletes associated with the signed-in user (across all orgs).
 * Athletes are global identities — the user sees every athlete they are a
 * guardian of or are themselves, regardless of which org created the athlete.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug } = await params;

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const userId = session.user.id;

    // Find ALL athletes the user is a guardian of (no org filter)
    const userGuardianLinks = await db.athleteGuardian.findMany({
      where: { userId },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            birthDate: true,
            gender: true,
            status: true,
            allowGuardianClaims: true,
            userId: true,
          },
        },
      },
    });

    // Also find the user's self-athlete (global singleton)
    const selfAthlete = await db.athlete.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        birthDate: true,
        gender: true,
        status: true,
        allowGuardianClaims: true,
        userId: true,
      },
    });

    // Deduplicate athletes from all sources
    const athleteMap = new Map<string, (typeof userGuardianLinks)[0]["athlete"]>();
    for (const link of userGuardianLinks) {
      athleteMap.set(link.athlete.id, link.athlete);
    }
    if (selfAthlete) {
      athleteMap.set(selfAthlete.id, selfAthlete);
    }

    const athletes = Array.from(athleteMap.values()).filter(
      (a) => a.status === "ACTIVE" || a.status === "TRIAL"
    );

    const hasSelfAthlete = selfAthlete != null;

    return NextResponse.json({ athletes, hasSelfAthlete });
  } catch (error) {
    console.error("Fetch athletes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch athletes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sites/[slug]/athletes
 *
 * Create a new athlete for the signed-in user.
 * Supports:
 *  - "isSelf" flag for self-athletes
 *  - Duplicate detection (firstName + lastName + birthDate + org)
 *  - Guardian claim for existing athletes
 *  - User-based guardian links
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug } = await params;
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

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const organizationId = config.organizationId;
    const userId = session.user.id;
    const userEmail = session.user.email;
    const userName = session.user.name || `${firstName} ${lastName}`;

    // Duplicate detection: check for matching athlete in the same org
    const parsedBirthDate = new Date(birthDate);
    const startOfDay = new Date(parsedBirthDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedBirthDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAthlete = await db.athlete.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
        birthDate: { gte: startOfDay, lte: endOfDay },
        organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        birthDate: true,
        gender: true,
        status: true,
        allowGuardianClaims: true,
        userId: true,
        guardians: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (existingAthlete) {
      // Already a guardian of this athlete
      if (existingAthlete.guardians.length > 0) {
        return NextResponse.json(
          { error: "You are already a guardian of this athlete" },
          { status: 409 }
        );
      }

      if (existingAthlete.allowGuardianClaims) {
        if (isSelf) {
          const existingSelf = await db.athlete.findUnique({ where: { userId } });
          if (existingSelf) {
            return NextResponse.json(
              { error: "You already have a self-athlete profile" },
              { status: 409 }
            );
          }
        }

        // Auto-claim: add user as a guardian instantly
        await db.athleteGuardian.create({
          data: {
            athleteId: existingAthlete.id,
            userId,
            relationship: isSelf ? "Self" : "Parent",
            isPrimary: false,
          },
        });

        if (isSelf) {
          await db.athlete.update({
            where: { id: existingAthlete.id },
            data: { userId },
          });
        }

        // Ensure OrganizationAthlete link exists
        await db.organizationAthlete.upsert({
          where: {
            organizationId_athleteId: { organizationId, athleteId: existingAthlete.id },
          },
          update: {},
          create: { organizationId, athleteId: existingAthlete.id },
        });

        return NextResponse.json({
          athlete: existingAthlete,
          claimed: true,
          message: "Athlete found and you have been added as a guardian.",
        }, { status: 200 });
      } else {
        // Cannot claim -- must request
        return NextResponse.json({
          error: "duplicate_found",
          message: "An athlete with this name and date of birth already exists at this organization. The athlete's guardian has not enabled other guardians to claim this athlete. Please contact the athlete's guardian or the organization's administrators to be added.",
          athleteId: existingAthlete.id,
        }, { status: 409 });
      }
    }

    // Cross-org duplicate detection: check if the user already has a matching
    // athlete from ANY org (prevents creating the same person twice)
    const userExistingAthlete = await db.athlete.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
        birthDate: { gte: startOfDay, lte: endOfDay },
        OR: [
          { guardians: { some: { userId } } },
          { userId },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        birthDate: true,
        gender: true,
        status: true,
        allowGuardianClaims: true,
        userId: true,
      },
    });

    if (userExistingAthlete) {
      return NextResponse.json({
        athlete: userExistingAthlete,
        claimed: false,
        message: "You already have this athlete in your account.",
      }, { status: 200 });
    }

    if (isSelf) {
      const existingSelfAthlete = await db.athlete.findUnique({
        where: { userId },
      });
      if (existingSelfAthlete) {
        return NextResponse.json(
          { error: "You already have a self-athlete profile" },
          { status: 409 }
        );
      }
    }

    const athlete = await db.athlete.create({
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        level: "Unassigned",
        birthDate: parsedBirthDate,
        gender,
        status: "ACTIVE",
        organizationId,
        userId: isSelf ? userId : undefined,
        allowGuardianClaims: allowGuardianClaims ?? false,
        guardians: {
          create: {
            userId,
            relationship: isSelf ? "Self" : "Parent",
            isPrimary: true,
          },
        },
        organizationAthletes: {
          create: { organizationId },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        birthDate: true,
        gender: true,
        status: true,
        allowGuardianClaims: true,
        userId: true,
      },
    });

    return NextResponse.json({ athlete }, { status: 201 });
  } catch (error) {
    console.error("Create athlete error:", error);
    return NextResponse.json(
      { error: "Failed to create athlete" },
      { status: 500 }
    );
  }
}
