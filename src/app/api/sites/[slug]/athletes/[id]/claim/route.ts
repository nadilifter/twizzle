import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

/**
 * POST /api/sites/[slug]/athletes/[id]/claim
 *
 * Request to be added as a guardian of an existing athlete.
 * If the athlete has allowGuardianClaims=true, the claim is instant.
 * Otherwise, a GuardianClaimRequest is created for review.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug, id: athleteId } = await params;
    const body = await request.json();
    const { relationship } = body;

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const athlete = await db.athlete.findFirst({
      where: { id: athleteId, organizationAthletes: { some: { organizationId: config.organizationId } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        allowGuardianClaims: true,
        userId: true,
        guardians: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json(
        { error: "Athlete not found" },
        { status: 404 }
      );
    }

    if (athlete.userId) {
      return NextResponse.json(
        { error: "Self-athletes cannot have additional guardians" },
        { status: 400 }
      );
    }

    if (athlete.guardians.length > 0) {
      return NextResponse.json(
        { error: "You are already a guardian of this athlete" },
        { status: 409 }
      );
    }

    const userId = session.user.id;

    if (athlete.allowGuardianClaims) {
      await db.athleteGuardian.create({
        data: {
          athleteId,
          userId,
          relationship: relationship || "Guardian",
          isPrimary: false,
        },
      });

      await db.organizationAthlete.upsert({
        where: {
          organizationId_athleteId: { organizationId: config.organizationId, athleteId },
        },
        update: {},
        create: { organizationId: config.organizationId, athleteId },
      });

      return NextResponse.json({
        success: true,
        instant: true,
        message: `You have been added as a guardian of ${athlete.firstName} ${athlete.lastName}.`,
      });
    }

    // Check for existing pending claim
    const existingClaim = await db.guardianClaimRequest.findUnique({
      where: { athleteId_requestingUserId: { athleteId, requestingUserId: userId } },
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: "You already have a pending claim request for this athlete", status: existingClaim.status },
        { status: 409 }
      );
    }

    const claimRequest = await db.guardianClaimRequest.create({
      data: {
        athleteId,
        requestingUserId: userId,
        relationship: relationship || "Guardian",
      },
    });

    return NextResponse.json({
      success: true,
      instant: false,
      claimRequest,
      message: "Your request to be added as a guardian has been submitted. The primary guardian or an administrator will review your request.",
    }, { status: 201 });
  } catch (error) {
    console.error("Claim athlete error:", error);
    return NextResponse.json(
      { error: "Failed to process claim request" },
      { status: 500 }
    );
  }
}
