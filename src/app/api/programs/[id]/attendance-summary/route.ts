import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  summarizeAttendanceByAthlete,
  summarizeAttendanceBySession,
} from "@/lib/program-attendance-aggregation";

/**
 * GET /api/programs/[id]/attendance-summary?view=athlete|session
 *
 * Returns aggregated attendance counts. `view=athlete` groups by athlete
 * (present/absent/late/excused/total/percentage), `view=session` groups by
 * ProgramInstance (counts per status for that session's roster).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id: programId } = await params;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "athlete";
    if (view !== "athlete" && view !== "session") {
      return NextResponse.json({ error: "Invalid view" }, { status: 400 });
    }

    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
      select: { id: true },
    });
    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const attendances = await db.instanceAttendance.findMany({
      where: { programInstance: { programId } },
      select: {
        id: true,
        status: true,
        athleteId: true,
        programInstanceId: true,
        athlete: { select: { id: true, name: true, avatar: true } },
        programInstance: {
          select: { id: true, date: true, startTime: true, endTime: true, status: true },
        },
      },
    });

    const rows =
      view === "athlete"
        ? summarizeAttendanceByAthlete(attendances)
        : summarizeAttendanceBySession(attendances);
    return NextResponse.json({ view, rows });
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    return NextResponse.json({ error: "Failed to fetch attendance summary" }, { status: 500 });
  }
}
