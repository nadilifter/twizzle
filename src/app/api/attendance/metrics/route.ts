import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

type StatusKey = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "REGISTERED";

function addStatus(
  stats: { total: number; present: number; absent: number; late: number; excused: number },
  status: string
) {
  stats.total++;
  if (status === "PRESENT") stats.present++;
  else if (status === "ABSENT") stats.absent++;
  else if (status === "LATE") stats.late++;
  else if (status === "EXCUSED") stats.excused++;
}

function calcRate(s: { total: number; present: number; late: number }) {
  return s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
}

// GET /api/attendance/metrics
// Combines data from both Event-based Attendance and InstanceAttendance
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get("groupBy") || "overall";
    const athleteId = searchParams.get("athleteId");
    const programId = searchParams.get("programId");
    const coachId = searchParams.get("coachId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const dateFilter =
      startDate && endDate ? { gte: new Date(startDate), lte: new Date(endDate) } : undefined;

    // ── Event-based Attendance where clause ──
    const eventWhere: any = {
      event: {
        organizationId: orgId,
        ...(programId && { programId }),
        ...(coachId && { coachId }),
        ...(dateFilter && { date: dateFilter }),
      },
      ...(athleteId && { athleteId }),
    };

    // ── Instance-based Attendance where clause ──
    const instanceWhere: any = {
      programInstance: {
        organizationId: orgId,
        ...(programId && { programId }),
        ...(dateFilter && { date: dateFilter }),
      },
      ...(athleteId && { athleteId }),
      status: { not: "REGISTERED" as const },
    };

    // ── Summary counts (both sources) ──
    const statusList: StatusKey[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "REGISTERED"];
    const [eventCounts, instanceCounts] = await Promise.all([
      Promise.all([
        db.attendance.count({ where: eventWhere }),
        ...statusList.map((s) => db.attendance.count({ where: { ...eventWhere, status: s } })),
      ]),
      Promise.all([
        db.instanceAttendance.count({ where: instanceWhere }),
        ...statusList.map((s) =>
          db.instanceAttendance.count({ where: { ...instanceWhere, status: s } })
        ),
      ]),
    ]);

    const total = eventCounts[0] + instanceCounts[0];
    const present = eventCounts[1] + instanceCounts[1];
    const absent = eventCounts[2] + instanceCounts[2];
    const late = eventCounts[3] + instanceCounts[3];
    const excused = eventCounts[4] + instanceCounts[4];
    const registered = eventCounts[5] + instanceCounts[5];

    const summary = {
      total,
      present,
      absent,
      late,
      excused,
      registered,
      attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
    };

    // ── Breakdown ──
    let breakdown: any[] = [];

    if (groupBy === "athlete") {
      const statsMap = new Map<
        string,
        { total: number; present: number; absent: number; late: number; excused: number }
      >();

      const [eventAtts, instanceAtts] = await Promise.all([
        db.attendance.findMany({ where: eventWhere, select: { athleteId: true, status: true } }),
        db.instanceAttendance.findMany({
          where: instanceWhere,
          select: { athleteId: true, status: true },
        }),
      ]);

      for (const att of [...eventAtts, ...instanceAtts]) {
        if (!statsMap.has(att.athleteId)) {
          statsMap.set(att.athleteId, { total: 0, present: 0, absent: 0, late: 0, excused: 0 });
        }
        addStatus(statsMap.get(att.athleteId)!, att.status);
      }

      const athleteIds = Array.from(statsMap.keys());
      if (athleteIds.length > 0) {
        const athletes = await db.athlete.findMany({
          where: { id: { in: athleteIds } },
          select: {
            id: true,
            name: true,
            avatar: true,
            organizationAthletes: {
              where: { organizationId: orgId },
              select: { level: true },
              take: 1,
            },
          },
        });
        const athleteMap = new Map(athletes.map((a) => [a.id, a]));

        breakdown = athleteIds
          .map((id) => {
            const s = statsMap.get(id)!;
            const athlete = athleteMap.get(id);
            return {
              id,
              name: athlete?.name || "Unknown",
              avatar: athlete?.avatar || null,
              level: athlete?.organizationAthletes?.[0]?.level || null,
              ...s,
              rate: calcRate(s),
            };
          })
          .sort((a, b) => b.total - a.total);
      }
    } else if (groupBy === "program") {
      const programStats = new Map<
        string,
        {
          id: string;
          name: string;
          total: number;
          present: number;
          absent: number;
          late: number;
          excused: number;
        }
      >();

      const [eventAtts, instanceAtts] = await Promise.all([
        db.attendance.findMany({
          where: eventWhere,
          select: {
            status: true,
            event: { select: { programId: true, program: { select: { id: true, name: true } } } },
          },
        }),
        db.instanceAttendance.findMany({
          where: instanceWhere,
          select: {
            status: true,
            programInstance: {
              select: { programId: true, program: { select: { id: true, name: true } } },
            },
          },
        }),
      ]);

      for (const att of eventAtts) {
        const pid = att.event.programId;
        if (!pid) continue;
        if (!programStats.has(pid)) {
          programStats.set(pid, {
            id: pid,
            name: att.event.program?.name || "Unknown",
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          });
        }
        addStatus(programStats.get(pid)!, att.status);
      }
      for (const att of instanceAtts) {
        const pid = att.programInstance.programId;
        if (!programStats.has(pid)) {
          programStats.set(pid, {
            id: pid,
            name: att.programInstance.program.name,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          });
        }
        addStatus(programStats.get(pid)!, att.status);
      }

      breakdown = Array.from(programStats.values())
        .map((s) => ({ ...s, rate: calcRate(s) }))
        .sort((a, b) => b.total - a.total);
    } else if (groupBy === "coach") {
      // Coach breakdown only applies to Event-based attendance (events have a coach; instances don't)
      const coachStats = new Map<
        string,
        {
          id: string;
          name: string;
          email: string | null;
          avatar: string | null;
          total: number;
          present: number;
          absent: number;
          late: number;
          excused: number;
        }
      >();

      const eventAtts = await db.attendance.findMany({
        where: eventWhere,
        select: {
          status: true,
          event: {
            select: {
              coachId: true,
              coach: { select: { id: true, name: true, email: true, avatar: true } },
            },
          },
        },
      });

      for (const att of eventAtts) {
        const cid = att.event.coachId;
        if (!cid) continue;
        if (!coachStats.has(cid)) {
          coachStats.set(cid, {
            id: cid,
            name: att.event.coach?.name || "Unknown",
            email: att.event.coach?.email || null,
            avatar: att.event.coach?.avatar || null,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          });
        }
        addStatus(coachStats.get(cid)!, att.status);
      }

      breakdown = Array.from(coachStats.values())
        .map((s) => ({ ...s, rate: calcRate(s) }))
        .sort((a, b) => b.total - a.total);
    } else if (groupBy === "date") {
      const dateStats = new Map<
        string,
        {
          date: string;
          total: number;
          present: number;
          absent: number;
          late: number;
          excused: number;
        }
      >();

      const [eventAtts, instanceAtts] = await Promise.all([
        db.attendance.findMany({
          where: eventWhere,
          select: { status: true, event: { select: { date: true } } },
          orderBy: { event: { date: "asc" } },
        }),
        db.instanceAttendance.findMany({
          where: instanceWhere,
          select: { status: true, programInstance: { select: { date: true } } },
          orderBy: { programInstance: { date: "asc" } },
        }),
      ]);

      for (const att of eventAtts) {
        const d = att.event.date.toISOString().split("T")[0];
        if (!dateStats.has(d))
          dateStats.set(d, { date: d, total: 0, present: 0, absent: 0, late: 0, excused: 0 });
        addStatus(dateStats.get(d)!, att.status);
      }
      for (const att of instanceAtts) {
        const d = att.programInstance.date.toISOString().split("T")[0];
        if (!dateStats.has(d))
          dateStats.set(d, { date: d, total: 0, present: 0, absent: 0, late: 0, excused: 0 });
        addStatus(dateStats.get(d)!, att.status);
      }

      breakdown = Array.from(dateStats.values())
        .map((s) => ({ ...s, rate: calcRate(s) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return NextResponse.json({
      summary,
      breakdown,
      filters: { groupBy, athleteId, programId, coachId, startDate, endDate },
    });
  } catch (error) {
    console.error("Error fetching attendance metrics:", error);
    return NextResponse.json({ error: "Failed to fetch attendance metrics" }, { status: 500 });
  }
}
