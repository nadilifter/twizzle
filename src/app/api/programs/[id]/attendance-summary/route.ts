import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

type AttendanceStatus = "REGISTERED" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

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

    if (view === "athlete") {
      type AthleteSummary = {
        athleteId: string;
        name: string | null;
        avatar: string | null;
        present: number;
        absent: number;
        late: number;
        excused: number;
        registered: number;
        total: number;
        percentage: number;
      };
      const byAthlete = new Map<string, AthleteSummary>();
      for (const a of attendances) {
        const existing =
          byAthlete.get(a.athleteId) ??
          ({
            athleteId: a.athleteId,
            name: a.athlete.name,
            avatar: a.athlete.avatar,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            registered: 0,
            total: 0,
            percentage: 0,
          } as AthleteSummary);
        switch (a.status as AttendanceStatus) {
          case "PRESENT":
            existing.present += 1;
            break;
          case "ABSENT":
            existing.absent += 1;
            break;
          case "LATE":
            existing.late += 1;
            break;
          case "EXCUSED":
            existing.excused += 1;
            break;
          case "REGISTERED":
            existing.registered += 1;
            break;
        }
        existing.total += 1;
        byAthlete.set(a.athleteId, existing);
      }

      // Percentage = (present + late) / (total - excused), where excused is neutral
      const rows = Array.from(byAthlete.values()).map((r) => {
        const denom = r.total - r.excused;
        const pct = denom > 0 ? Math.round(((r.present + r.late) / denom) * 100) : 0;
        return { ...r, percentage: pct };
      });

      rows.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      return NextResponse.json({ view, rows });
    }

    // view === "session"
    type SessionSummary = {
      instanceId: string;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
      registered: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
    };
    const bySession = new Map<string, SessionSummary>();
    for (const a of attendances) {
      const existing =
        bySession.get(a.programInstanceId) ??
        ({
          instanceId: a.programInstanceId,
          date: a.programInstance.date.toISOString(),
          startTime: a.programInstance.startTime,
          endTime: a.programInstance.endTime,
          status: a.programInstance.status,
          registered: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        } as SessionSummary);
      switch (a.status as AttendanceStatus) {
        case "PRESENT":
          existing.present += 1;
          break;
        case "ABSENT":
          existing.absent += 1;
          break;
        case "LATE":
          existing.late += 1;
          break;
        case "EXCUSED":
          existing.excused += 1;
          break;
        case "REGISTERED":
          existing.registered += 1;
          break;
      }
      existing.total += 1;
      bySession.set(a.programInstanceId, existing);
    }

    const rows = Array.from(bySession.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return NextResponse.json({ view, rows });
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    return NextResponse.json({ error: "Failed to fetch attendance summary" }, { status: 500 });
  }
}
