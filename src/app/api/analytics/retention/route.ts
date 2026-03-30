import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";

// GET /api/analytics/retention
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
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalAthletes,
      activeAthletes,
      churnedThisMonth,
      churnedLastMonth,
      newThisMonth,
      avgTenureResult,
      athleteFlow,
      cohortRetention,
      enrollmentsByStatus,
      atRiskCharges,
      recentCancelledEnrollments,
    ] = await Promise.all([
      // KPI: total all-time athletes
      scopedDb.organizationAthlete.count(),

      // KPI: active athletes
      scopedDb.organizationAthlete.count({
        where: { status: "ACTIVE" },
      }),

      // KPI: churned this month (non-ACTIVE whose updatedAt is this month, joined before this month)
      scopedDb.organizationAthlete.count({
        where: {
          status: { not: "ACTIVE" },
          updatedAt: { gte: monthStart },
          createdAt: { lt: monthStart },
        },
      }),

      // KPI: churned last month (for comparison)
      scopedDb.organizationAthlete.count({
        where: {
          status: { not: "ACTIVE" },
          updatedAt: { gte: lastMonthStart, lt: monthStart },
          createdAt: { lt: lastMonthStart },
        },
      }),

      // KPI: new athletes this month
      scopedDb.organizationAthlete.count({
        where: { createdAt: { gte: monthStart } },
      }),

      // KPI: average tenure of active athletes (in days)
      db.$queryRaw<{ avg_days: number | null }[]>`
        SELECT EXTRACT(EPOCH FROM AVG(NOW() - oa."createdAt")) / 86400 AS avg_days
        FROM "OrganizationAthlete" oa
        WHERE oa."organizationId" = ${orgId}
          AND oa."status" = 'ACTIVE'
      `,

      // Athlete flow: monthly new vs churned (last 12 months)
      db.$queryRaw<{ month: string; new_count: number; churned_count: number }[]>`
        WITH months AS (
          SELECT to_char(d, 'YYYY-MM') AS month
          FROM generate_series(
            date_trunc('month', NOW()) - INTERVAL '11 months',
            date_trunc('month', NOW()),
            '1 month'
          ) d
        ),
        new_counts AS (
          SELECT to_char(oa."createdAt", 'YYYY-MM') AS month, COUNT(*)::int AS cnt
          FROM "OrganizationAthlete" oa
          WHERE oa."organizationId" = ${orgId}
            AND oa."createdAt" >= date_trunc('month', NOW()) - INTERVAL '11 months'
          GROUP BY 1
        ),
        churn_counts AS (
          SELECT to_char(oa."updatedAt", 'YYYY-MM') AS month, COUNT(*)::int AS cnt
          FROM "OrganizationAthlete" oa
          WHERE oa."organizationId" = ${orgId}
            AND oa."status" != 'ACTIVE'
            AND oa."updatedAt" >= date_trunc('month', NOW()) - INTERVAL '11 months'
            AND oa."createdAt" < date_trunc('month', oa."updatedAt")
          GROUP BY 1
        )
        SELECT m.month,
               COALESCE(n.cnt, 0)::int AS new_count,
               COALESCE(c.cnt, 0)::int AS churned_count
        FROM months m
        LEFT JOIN new_counts n ON n.month = m.month
        LEFT JOIN churn_counts c ON c.month = m.month
        ORDER BY m.month ASC
      `,

      // Cohort retention: join month -> total vs still active
      db.$queryRaw<{ cohort: string; total: number; retained: number }[]>`
        SELECT
          to_char(oa."createdAt", 'YYYY-MM') AS cohort,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE oa."status" = 'ACTIVE')::int AS retained
        FROM "OrganizationAthlete" oa
        WHERE oa."organizationId" = ${orgId}
          AND oa."createdAt" >= date_trunc('month', NOW()) - INTERVAL '11 months'
        GROUP BY 1
        ORDER BY 1 ASC
      `,

      // Enrollment health: count by status
      db.$queryRaw<{ status: string; count: number }[]>`
        SELECT e."status"::text AS status, COUNT(*)::int AS count
        FROM "Enrollment" e
        INNER JOIN "Program" p ON e."programId" = p."id"
        WHERE p."organizationId" = ${orgId}
        GROUP BY e."status"
        ORDER BY count DESC
      `,

      // At-risk: recurring charges with failures
      scopedDb.recurringCharge.count({
        where: {
          OR: [{ status: "FAILED" }, { failureCount: { gt: 0 } }],
        },
      }),

      // At-risk: recently cancelled enrollments (last 30 days)
      db.enrollment.count({
        where: {
          program: { organizationId: orgId },
          status: "CANCELLED",
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const retentionRate =
      totalAthletes > 0 ? Math.round((activeAthletes / totalAthletes) * 100) : 0;

    const avgTenureDays = avgTenureResult[0]?.avg_days ?? 0;

    return NextResponse.json({
      kpis: {
        retentionRate,
        activeAthletes,
        totalAthletes,
        churnedThisMonth,
        churnedLastMonth,
        newThisMonth,
        netGrowth: newThisMonth - churnedThisMonth,
        avgTenureDays: Math.round(avgTenureDays),
      },
      athleteFlow: athleteFlow.map((row) => ({
        month: row.month,
        new: Number(row.new_count),
        churned: Number(row.churned_count),
      })),
      cohortRetention: cohortRetention.map((row) => ({
        cohort: row.cohort,
        total: Number(row.total),
        retained: Number(row.retained),
        rate:
          Number(row.total) > 0 ? Math.round((Number(row.retained) / Number(row.total)) * 100) : 0,
      })),
      enrollmentHealth: enrollmentsByStatus.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      atRisk: {
        failingCharges: atRiskCharges,
        recentCancellations: recentCancelledEnrollments,
      },
    });
  } catch (error) {
    console.error("Error fetching retention analytics:", error);
    return NextResponse.json({ error: "Failed to fetch retention data" }, { status: 500 });
  }
}
