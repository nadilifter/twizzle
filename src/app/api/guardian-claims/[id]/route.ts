import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

/**
 * PATCH /api/guardian-claims/[id]
 *
 * Approve or deny a guardian claim request.
 * Only the primary guardian of the athlete or an organization admin can do this.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // "approve" or "deny"

    if (!["approve", "deny"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'deny'" },
        { status: 400 }
      );
    }

    const claim = await db.guardianClaimRequest.findUnique({
      where: { id },
      include: {
        athlete: {
          select: {
            id: true,
            userId: true,
            organizationAthletes: {
              select: { organizationId: true },
            },
            guardians: {
              where: { isPrimary: true, userId: { not: null } },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Claim request not found" },
        { status: 404 }
      );
    }

    if (claim.status !== "PENDING") {
      return NextResponse.json(
        { error: "Claim request has already been processed" },
        { status: 409 }
      );
    }

    // Authorization: must be primary guardian or org admin of any linked org
    const userId = session.user.id;
    const isPrimaryGuardian = claim.athlete.guardians.some(
      (g) => g.userId === userId
    );

    let isOrgAdmin = false;
    for (const oa of claim.athlete.organizationAthletes) {
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: oa.organizationId,
            userId,
          },
        },
        select: { role: true },
      });
      if (membership?.role === "ADMIN") {
        isOrgAdmin = true;
        break;
      }
    }

    if (!isPrimaryGuardian && !isOrgAdmin) {
      return NextResponse.json(
        { error: "Only the primary guardian or an organization admin can review claims" },
        { status: 403 }
      );
    }

    if (action === "approve" && claim.athlete.userId) {
      return NextResponse.json(
        { error: "Self-athletes cannot have additional guardians" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      await db.$transaction([
        db.guardianClaimRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedByUserId: userId,
            reviewedAt: new Date(),
          },
        }),
        db.athleteGuardian.create({
          data: {
            athleteId: claim.athleteId,
            userId: claim.requestingUserId,
            relationship: claim.relationship || "Guardian",
            isPrimary: false,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "Guardian claim approved.",
      });
    } else {
      await db.guardianClaimRequest.update({
        where: { id },
        data: {
          status: "DENIED",
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Guardian claim denied.",
      });
    }
  } catch (error) {
    console.error("Process guardian claim error:", error);
    return NextResponse.json(
      { error: "Failed to process claim" },
      { status: 500 }
    );
  }
}
