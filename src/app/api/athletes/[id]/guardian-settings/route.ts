import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  shareRegistrations: z.boolean().optional(),
  shareFinancials: z.boolean().optional(),
  allowGuardianClaims: z.boolean().optional(),
});

/**
 * PATCH /api/athletes/[id]/guardian-settings
 *
 * Updates visibility settings (shareRegistrations, shareFinancials) for the
 * current user's guardian link to an athlete.
 * Also allows toggling allowGuardianClaims on the athlete (only primary guardian can do this).
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

    const { id: athleteId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { shareRegistrations, shareFinancials, allowGuardianClaims } =
      parsed.data;

    const guardianLink = await db.athleteGuardian.findFirst({
      where: {
        athleteId,
        userId: session.user.id,
      },
    });

    if (!guardianLink) {
      return NextResponse.json(
        { error: "Access denied: You are not a guardian of this athlete" },
        { status: 403 }
      );
    }

    // allowGuardianClaims can only be updated by primary guardian
    if (allowGuardianClaims !== undefined && !guardianLink.isPrimary) {
      return NextResponse.json(
        {
          error:
            "Only the primary guardian can update allowGuardianClaims setting",
        },
        { status: 403 }
      );
    }

    // Self-athletes cannot enable guardian claims
    if (allowGuardianClaims === true) {
      const athlete = await db.athlete.findUnique({
        where: { id: athleteId },
        select: { userId: true },
      });
      if (athlete?.userId) {
        return NextResponse.json(
          { error: "Self-athletes cannot have additional guardians" },
          { status: 400 }
        );
      }
    }

    const updates: { shareRegistrations?: boolean; shareFinancials?: boolean } =
      {};
    if (shareRegistrations !== undefined) updates.shareRegistrations = shareRegistrations;
    if (shareFinancials !== undefined) updates.shareFinancials = shareFinancials;

    let updatedGuardian = guardianLink;
    let updatedAthlete: { allowGuardianClaims: boolean } | null = null;

    if (Object.keys(updates).length > 0) {
      updatedGuardian = await db.athleteGuardian.update({
        where: { id: guardianLink.id },
        data: updates,
      });
    }

    if (allowGuardianClaims !== undefined) {
      const athlete = await db.athlete.update({
        where: { id: athleteId },
        data: { allowGuardianClaims },
      });
      updatedAthlete = { allowGuardianClaims: athlete.allowGuardianClaims };
    }

    return NextResponse.json({
      guardian: updatedGuardian,
      athlete: updatedAthlete ?? undefined,
    });
  } catch (error) {
    console.error("PATCH /api/athletes/[id]/guardian-settings error:", error);
    return NextResponse.json(
      { error: "Failed to update guardian settings" },
      { status: 500 }
    );
  }
}
