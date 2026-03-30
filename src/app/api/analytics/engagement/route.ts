import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";

// GET /api/analytics/engagement
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;

    const gate = await checkFeatureGate(orgId, "analytics");
    if (gate) return gate;

    const scopedDb = getScopedDb(orgId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      attendanceRateResult,
      classesThisMonth,
      avgClassSizeResult,
      evaluationsCompleted,
      attendanceTrend,
      attendanceBreakdown,
      classUtilization,
      inactiveAthletes,
    ] = await Promise.all([
      // KPI: attendance rate this month (present+late / total checked-in)
      db.$queryRaw<{ rate: number | null }[]>`
        SELECT
          CASE
            WHEN COUNT(*) FILTER (WHERE ia."status" != 'REGISTERED') = 0 THEN 0
            ELSE ROUND(
              COUNT(*) FILTER (WHERE ia."status" IN ('PRESENT', 'LATE'))::numeric * 100.0
              / COUNT(*) FILTER (WHERE ia."status" != 'REGISTERED'),
              0
            )
          END AS rate
        FROM "InstanceAttendance" ia
        INNER JOIN "ProgramInstance" pi ON ia."programInstanceId" = pi."id"
        WHERE pi."organizationId" = ${orgId}
          AND pi."date" >= ${monthStart}
      `,

      // KPI: completed classes this month
      scopedDb.programInstance.count({
        where: {
          status: "COMPLETED",
          date: { gte: monthStart },
        },
      }),

      // KPI: average class size (present+late per completed instance this month)
      db.$queryRaw<{ avg_size: number | null }[]>`
        SELECT ROUND(AVG(cnt)::numeric, 1) AS avg_size
        FROM (
          SELECT pi."id", COUNT(*) FILTER (WHERE ia."status" IN ('PRESENT', 'LATE')) AS cnt
          FROM "ProgramInstance" pi
          LEFT JOIN "InstanceAttendance" ia ON ia."programInstanceId" = pi."id"
          WHERE pi."organizationId" = ${orgId}
            AND pi."status" = 'COMPLETED'
            AND pi."date" >= ${monthStart}
          GROUP BY pi."id"
        ) sub
      `,

      // KPI: evaluations completed this month
      db.evaluation.count({
        where: {
          program: { organizationId: orgId },
          status: { not: "PENDING" },
          date: { gte: monthStart },
        },
      }),

      // Attendance trend: monthly attendance rate over 12 months
      db.$queryRaw<{ month: string; rate: number }[]>`
        WITH months AS (
          SELECT to_char(d, 'YYYY-MM') AS month
          FROM generate_series(
            date_trunc('month', NOW()) - INTERVAL '11 months',
            date_trunc('month', NOW()),
            '1 month'
          ) d
        ),
        monthly_data AS (
          SELECT
            to_char(pi."date", 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE ia."status" IN ('PRESENT', 'LATE'))::numeric AS attended,
            COUNT(*) FILTER (WHERE ia."status" != 'REGISTERED')::numeric AS total
          FROM "InstanceAttendance" ia
          INNER JOIN "ProgramInstance" pi ON ia."programInstanceId" = pi."id"
          WHERE pi."organizationId" = ${orgId}
            AND pi."date" >= date_trunc('month', NOW()) - INTERVAL '11 months'
          GROUP BY 1
        )
        SELECT m.month,
               CASE WHEN COALESCE(md.total, 0) = 0 THEN 0
                    ELSE ROUND(COALESCE(md.attended, 0) * 100.0 / md.total, 0)
               END::int AS rate
        FROM months m
        LEFT JOIN monthly_data md ON md.month = m.month
        ORDER BY m.month ASC
      `,

      // Attendance breakdown by status
      db.$queryRaw<{ status: string; count: number }[]>`
        SELECT ia."status"::text AS status, COUNT(*)::int AS count
        FROM "InstanceAttendance" ia
        INNER JOIN "ProgramInstance" pi ON ia."programInstanceId" = pi."id"
        WHERE pi."organizationId" = ${orgId}
          AND ia."status" != 'REGISTERED'
        GROUP BY ia."status"
        ORDER BY count DESC
      `,

      // Class utilization: top 10 programs by avg attendance vs capacity
      db.$queryRaw<{ name: string; avg_attendance: number; capacity: number }[]>`
        SELECT
          prog."name",
          ROUND(AVG(sub.attended)::numeric, 1) AS avg_attendance,
          COALESCE(prog."capacity", 0)::int AS capacity
        FROM "Program" prog
        INNER JOIN "ProgramInstance" pi ON pi."programId" = prog."id"
        INNER JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE ia."status" IN ('PRESENT', 'LATE')) AS attended
          FROM "InstanceAttendance" ia
          WHERE ia."programInstanceId" = pi."id"
        ) sub ON true
        WHERE prog."organizationId" = ${orgId}
          AND prog."status" = 'ACTIVE'
          AND prog."capacity" IS NOT NULL
          AND prog."capacity" > 0
        GROUP BY prog."id", prog."name", prog."capacity"
        ORDER BY AVG(sub.attended)::numeric / prog."capacity" DESC
        LIMIT 10
      `,

      // Inactive athletes: active org athletes with no attendance in last 30 days
      db.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM "OrganizationAthlete" oa
        WHERE oa."organizationId" = ${orgId}
          AND oa."status" = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM "InstanceAttendance" ia
            INNER JOIN "ProgramInstance" pi ON ia."programInstanceId" = pi."id"
            WHERE ia."athleteId" = oa."athleteId"
              AND pi."organizationId" = ${orgId}
              AND pi."date" >= ${thirtyDaysAgo}
              AND ia."status" IN ('PRESENT', 'LATE')
          )
      `,
    ]);

    return NextResponse.json({
      kpis: {
        attendanceRate: Number(attendanceRateResult[0]?.rate ?? 0),
        classesThisMonth,
        avgClassSize: Number(avgClassSizeResult[0]?.avg_size ?? 0),
        evaluationsCompleted,
      },
      attendanceTrend: attendanceTrend.map((row) => ({
        month: row.month,
        rate: Number(row.rate),
      })),
      attendanceBreakdown: attendanceBreakdown.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      classUtilization: classUtilization.map((row) => ({
        name: row.name,
        avgAttendance: Number(row.avg_attendance),
        capacity: Number(row.capacity),
      })),
      inactiveAthletes: Number(inactiveAthletes[0]?.count ?? 0),
    });
  } catch (error) {
    console.error("Error fetching engagement analytics:", error);
    return NextResponse.json({ error: "Failed to fetch engagement data" }, { status: 500 });
  }
}
