import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/sites/[slug]/athletes
 *
 * Fetch athletes associated with the signed-in user for this organization.
 * Finds families by the user's email + organizationId, then follows
 * AthleteGuardian relations to get athletes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug } = await params;

    // Look up the organization from the site config
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Find families for this user's email in this organization
    const families = await db.family.findMany({
      where: {
        email: session.user.email,
        organizationId: config.organizationId,
      },
      select: { id: true },
    });

    if (families.length === 0) {
      return NextResponse.json({ athletes: [] });
    }

    const familyIds = families.map((f) => f.id);

    // Find athletes via AthleteGuardian
    const guardianLinks = await db.athleteGuardian.findMany({
      where: { familyId: { in: familyIds } },
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
          },
        },
      },
    });

    // Deduplicate athletes (could be linked via multiple families)
    const athleteMap = new Map<string, typeof guardianLinks[0]["athlete"]>();
    for (const link of guardianLinks) {
      if (!athleteMap.has(link.athlete.id)) {
        athleteMap.set(link.athlete.id, link.athlete);
      }
    }

    const athletes = Array.from(athleteMap.values()).filter(
      (a) => a.status === "ACTIVE" || a.status === "TRIAL"
    );

    return NextResponse.json({ athletes });
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
 * Finds or creates a Family, creates the Athlete, and links them
 * via AthleteGuardian.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const body = await request.json();

    const { firstName, lastName, birthDate, gender } = body;

    // Validate required fields
    if (!firstName || !lastName || !birthDate || !gender) {
      return NextResponse.json(
        { error: "firstName, lastName, birthDate, and gender are required" },
        { status: 400 }
      );
    }

    // Validate gender value
    const validGenders = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];
    if (!validGenders.includes(gender)) {
      return NextResponse.json(
        { error: "Invalid gender value" },
        { status: 400 }
      );
    }

    // Look up the organization from the site config
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const organizationId = config.organizationId;
    const userEmail = session.user.email;
    const userName = session.user.name || `${firstName} ${lastName}`;

    // Find or create a Family for this user in this org
    let family = await db.family.findFirst({
      where: {
        email: userEmail,
        organizationId,
      },
    });

    if (!family) {
      family = await db.family.create({
        data: {
          name: `${lastName} Family`,
          primaryContact: userName,
          email: userEmail,
          phone: "",
          organizationId,
        },
      });
    }

    // Create the athlete
    const athlete = await db.athlete.create({
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        level: "Unassigned",
        group: "Unassigned",
        birthDate: new Date(birthDate),
        gender,
        status: "ACTIVE",
        organizationId,
        guardians: {
          create: {
            familyId: family.id,
            relationship: "Parent",
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
        status: true,
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
