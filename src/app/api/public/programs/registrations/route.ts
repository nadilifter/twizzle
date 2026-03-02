import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/programs/registrations?programId=xxx&athleteId=xxx
 *
 * Returns instance IDs the athlete is already registered for within a program,
 * plus whether they have an active full-program enrollment.
 * Used by the registration flow to prevent duplicate sign-ups.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");
    const athleteId = searchParams.get("athleteId");

    if (!programId || !athleteId) {
      return NextResponse.json(
        { error: "programId and athleteId are required" },
        { status: 400 }
      );
    }

    const [instanceRegistrations, enrollment] = await Promise.all([
      db.instanceRegistration.findMany({
        where: {
          athleteId,
          programInstance: { programId },
          status: { not: "CANCELLED" },
        },
        select: { programInstanceId: true },
      }),
      db.enrollment.findFirst({
        where: {
          athleteId,
          programId,
          status: { in: ["ACTIVE", "PAUSED"] },
        },
        select: { id: true },
      }),
    ]);

    return NextResponse.json({
      registeredInstanceIds: instanceRegistrations.map(
        (r) => r.programInstanceId
      ),
      hasFullEnrollment: !!enrollment,
    });
  } catch (error) {
    console.error("Error checking program registrations:", error);
    return NextResponse.json(
      { error: "Failed to check registrations" },
      { status: 500 }
    );
  }
}
