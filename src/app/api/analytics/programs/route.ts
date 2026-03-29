import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";

// GET /api/analytics/programs
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

    const [
      activePrograms,
      activeEnrollments,
      waitlistedEnrollments,
      avgFillRateResult,
      enrollmentTrend,
      fillRates,
      enrollmentsByStatus,
      topProgramsByRevenue,
    ] = await Promise.all([
      // KPI: active programs
      scopedDb.program.count({
        where: { status: "ACTIVE" },
      }),

      // KPI: active enrollments
      db.enrollment.count({
        where: {
          program: { organizationId: orgId },
          status: "ACTIVE",
        },
      }),

      // KPI: waitlisted enrollments
      db.enrollment.count({
        where: {
          program: { organizationId: orgId },
          status: "WAITLISTED",
        },
      }),

      // KPI: avg fill rate across programs with capacity
      db.$queryRaw<{ avg_rate: number | null }[]>`
        SELECT ROUND(AVG(
          CASE WHEN p."capacity" > 0
            THEN (active_count::numeric / p."capacity") * 100
            ELSE NULL
          END
        ), 0) AS avg_rate
        FROM "Program" p
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS active_count
          FROM "Enrollment" e
          WHERE e."programId" = p."id" AND e."status" = 'ACTIVE'
        ) ec ON true
        WHERE p."organizationId" = ${orgId}
          AND p."status" = 'ACTIVE'
          AND p."capacity" IS NOT NULL
          AND p."capacity" > 0
      `,

      // Enrollment trend: monthly new enrollments over 12 months
      db.$queryRaw<{ month: string; count: number }[]>`
        WITH months AS (
          SELECT to_char(d, 'YYYY-MM') AS month
          FROM generate_series(
            date_trunc('month', NOW()) - INTERVAL '11 months',
            date_trunc('month', NOW()),
            '1 month'
          ) d
        )
        SELECT m.month, COALESCE(ec.cnt, 0)::int AS count
        FROM months m
        LEFT JOIN (
          SELECT to_char(e."createdAt", 'YYYY-MM') AS month, COUNT(*)::int AS cnt
          FROM "Enrollment" e
          INNER JOIN "Program" p ON e."programId" = p."id"
          WHERE p."organizationId" = ${orgId}
            AND e."createdAt" >= date_trunc('month', NOW()) - INTERVAL '11 months'
          GROUP BY 1
        ) ec ON ec.month = m.month
        ORDER BY m.month ASC
      `,

      // Program fill rates: top 10 by fill % (programs with capacity)
      db.$queryRaw<{ name: string; enrolled: number; capacity: number }[]>`
        SELECT
          p."name",
          COALESCE(ec.active_count, 0)::int AS enrolled,
          p."capacity"::int AS capacity
        FROM "Program" p
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS active_count
          FROM "Enrollment" e
          WHERE e."programId" = p."id" AND e."status" = 'ACTIVE'
        ) ec ON true
        WHERE p."organizationId" = ${orgId}
          AND p."status" = 'ACTIVE'
          AND p."capacity" IS NOT NULL
          AND p."capacity" > 0
        ORDER BY (COALESCE(ec.active_count, 0)::numeric / p."capacity") DESC
        LIMIT 10
      `,

      // Enrollment status breakdown
      db.$queryRaw<{ status: string; count: number }[]>`
        SELECT e."status"::text AS status, COUNT(*)::int AS count
        FROM "Enrollment" e
        INNER JOIN "Program" p ON e."programId" = p."id"
        WHERE p."organizationId" = ${orgId}
        GROUP BY e."status"
        ORDER BY count DESC
      `,

      // Top programs by revenue (from paid invoices)
      db.$queryRaw<{ name: string; revenue: number }[]>`
        SELECT
          p."name",
          COALESCE(SUM(li."total"), 0)::numeric AS revenue
        FROM "LineItem" li
        INNER JOIN "Invoice" i ON li."invoiceId" = i."id"
        INNER JOIN "Program" p ON li."programId" = p."id"
        WHERE i."organizationId" = ${orgId}
          AND i."status" = 'PAID'
          AND li."programId" IS NOT NULL
        GROUP BY p."id", p."name"
        ORDER BY revenue DESC
        LIMIT 10
      `,
    ]);

    return NextResponse.json({
      kpis: {
        activePrograms,
        activeEnrollments,
        waitlisted: waitlistedEnrollments,
        avgFillRate: Number(avgFillRateResult[0]?.avg_rate ?? 0),
      },
      enrollmentTrend: enrollmentTrend.map((row) => ({
        month: row.month,
        count: Number(row.count),
      })),
      fillRates: fillRates.map((row) => ({
        name: row.name,
        enrolled: Number(row.enrolled),
        capacity: Number(row.capacity),
        rate: Number(row.capacity) > 0
          ? Math.round((Number(row.enrolled) / Number(row.capacity)) * 100)
          : 0,
      })),
      enrollmentsByStatus: enrollmentsByStatus.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      topByRevenue: topProgramsByRevenue
        .filter((row) => Number(row.revenue) > 0)
        .map((row) => ({
          name: row.name,
          revenue: Number(row.revenue),
        })),
    });
  } catch (error) {
    console.error("Error fetching programs analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch programs data" },
      { status: 500 }
    );
  }
}
