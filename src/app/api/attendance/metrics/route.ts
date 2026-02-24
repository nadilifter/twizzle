import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/attendance/metrics
// Query params:
// - groupBy: "overall" | "athlete" | "program" | "coach"
// - athleteId, programId, coachId: optional filters
// - startDate, endDate: date range filter
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get("groupBy") || "overall";
    const athleteId = searchParams.get("athleteId");
    const programId = searchParams.get("programId");
    const coachId = searchParams.get("coachId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Base where clause scoped to organization
    const baseWhere: any = {
      event: {
        organizationId: session.user.organizationId,
        ...(programId && { programId }),
        ...(coachId && { coachId }),
        ...(startDate && endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      },
      ...(athleteId && { athleteId }),
    };

    // Get overall summary counts
    const [totalCount, presentCount, absentCount, lateCount, excusedCount, registeredCount] = await Promise.all([
      db.attendance.count({ where: baseWhere }),
      db.attendance.count({ where: { ...baseWhere, status: "PRESENT" } }),
      db.attendance.count({ where: { ...baseWhere, status: "ABSENT" } }),
      db.attendance.count({ where: { ...baseWhere, status: "LATE" } }),
      db.attendance.count({ where: { ...baseWhere, status: "EXCUSED" } }),
      db.attendance.count({ where: { ...baseWhere, status: "REGISTERED" } }),
    ]);

    const summary = {
      total: totalCount,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      excused: excusedCount,
      registered: registeredCount,
      attendanceRate: totalCount > 0 
        ? Math.round(((presentCount + lateCount) / totalCount) * 100) 
        : 0,
    };

    // Get breakdown based on groupBy
    let breakdown: any[] = [];

    if (groupBy === "athlete") {
      // Group by athlete
      const athleteStats = await db.attendance.groupBy({
        by: ["athleteId"],
        where: baseWhere,
        _count: {
          id: true,
        },
      });

      // Get counts by status for each athlete
      const athleteIds = athleteStats.map(s => s.athleteId);
      
      if (athleteIds.length > 0) {
        const athletes = await db.athlete.findMany({
          where: { id: { in: athleteIds } },
          select: {
            id: true,
            name: true,
            organizationAthletes: {
              where: { organizationId: session.user.organizationId },
              select: { level: true },
              take: 1,
            },
          },
        });

        const athleteMap = new Map(athletes.map(a => [a.id, a]));

        // Get detailed status counts per athlete
        const detailedStats = await Promise.all(
          athleteIds.map(async (athleteId) => {
            const whereWithAthlete = { ...baseWhere, athleteId };
            const [total, present, absent, late, excused] = await Promise.all([
              db.attendance.count({ where: whereWithAthlete }),
              db.attendance.count({ where: { ...whereWithAthlete, status: "PRESENT" } }),
              db.attendance.count({ where: { ...whereWithAthlete, status: "ABSENT" } }),
              db.attendance.count({ where: { ...whereWithAthlete, status: "LATE" } }),
              db.attendance.count({ where: { ...whereWithAthlete, status: "EXCUSED" } }),
            ]);

            const athlete = athleteMap.get(athleteId);
            return {
              id: athleteId,
              name: athlete?.name || "Unknown",
              level: athlete?.organizationAthletes?.[0]?.level || null,
              total,
              present,
              absent,
              late,
              excused,
              rate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
            };
          })
        );

        breakdown = detailedStats.sort((a, b) => b.total - a.total);
      }
    } else if (groupBy === "program") {
      // Group by program (via event)
      const attendancesWithProgram = await db.attendance.findMany({
        where: baseWhere,
        select: {
          id: true,
          status: true,
          event: {
            select: {
              programId: true,
              program: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Aggregate by program
      const programStats = new Map<string, {
        id: string;
        name: string;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }>();

      for (const att of attendancesWithProgram) {
        const programId = att.event.programId;
        if (!programId) continue;

        const program = att.event.program;
        if (!programStats.has(programId)) {
          programStats.set(programId, {
            id: programId,
            name: program?.name || "Unknown",
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          });
        }

        const stats = programStats.get(programId)!;
        stats.total++;
        if (att.status === "PRESENT") stats.present++;
        else if (att.status === "ABSENT") stats.absent++;
        else if (att.status === "LATE") stats.late++;
        else if (att.status === "EXCUSED") stats.excused++;
      }

      breakdown = Array.from(programStats.values())
        .map(stats => ({
          ...stats,
          rate: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);
    } else if (groupBy === "coach") {
      // Group by coach (via event)
      const attendancesWithCoach = await db.attendance.findMany({
        where: baseWhere,
        select: {
          id: true,
          status: true,
          event: {
            select: {
              coachId: true,
              coach: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Aggregate by coach
      const coachStats = new Map<string, {
        id: string;
        name: string;
        email: string | null;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }>();

      for (const att of attendancesWithCoach) {
        const coachId = att.event.coachId;
        if (!coachId) continue;

        const coach = att.event.coach;
        if (!coachStats.has(coachId)) {
          coachStats.set(coachId, {
            id: coachId,
            name: coach?.name || "Unknown",
            email: coach?.email || null,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          });
        }

        const stats = coachStats.get(coachId)!;
        stats.total++;
        if (att.status === "PRESENT") stats.present++;
        else if (att.status === "ABSENT") stats.absent++;
        else if (att.status === "LATE") stats.late++;
        else if (att.status === "EXCUSED") stats.excused++;
      }

      breakdown = Array.from(coachStats.values())
        .map(stats => ({
          ...stats,
          rate: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);
    } else if (groupBy === "date") {
      // Group by date for trend analysis
      const attendancesWithDate = await db.attendance.findMany({
        where: baseWhere,
        select: {
          id: true,
          status: true,
          event: {
            select: {
              date: true,
            },
          },
        },
        orderBy: {
          event: {
            date: "asc",
          },
        },
      });

      // Aggregate by date
      const dateStats = new Map<string, {
        date: string;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }>();

      for (const att of attendancesWithDate) {
        const dateStr = att.event.date.toISOString().split("T")[0];
        
        if (!dateStats.has(dateStr)) {
          dateStats.set(dateStr, {
            date: dateStr,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          });
        }

        const stats = dateStats.get(dateStr)!;
        stats.total++;
        if (att.status === "PRESENT") stats.present++;
        else if (att.status === "ABSENT") stats.absent++;
        else if (att.status === "LATE") stats.late++;
        else if (att.status === "EXCUSED") stats.excused++;
      }

      breakdown = Array.from(dateStats.values())
        .map(stats => ({
          ...stats,
          rate: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0,
        }));
    }

    return NextResponse.json({
      summary,
      breakdown,
      filters: {
        groupBy,
        athleteId,
        programId,
        coachId,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error("Error fetching attendance metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance metrics" },
      { status: 500 }
    );
  }
}
