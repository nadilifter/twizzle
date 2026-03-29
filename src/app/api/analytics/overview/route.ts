import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";

// GET /api/analytics/overview
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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalAthletes,
      newAthletes,
      activePrograms,
      totalEnrollments,
      teamMembers,
      athletesWithDemographics,
      levelGroups,
      statusGroups,
      enrollmentTrend,
    ] = await Promise.all([
      // KPI: total active athletes
      scopedDb.organizationAthlete.count({
        where: { status: "ACTIVE" },
      }),

      // KPI: new athletes in last 30 days
      scopedDb.organizationAthlete.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),

      // KPI: active programs
      scopedDb.program.count({
        where: { status: "ACTIVE" },
      }),

      // KPI: total enrollments (scoped via program relation)
      db.enrollment.count({
        where: { program: { organizationId: orgId } },
      }),

      // KPI: team members
      scopedDb.organizationMember.count({
        where: { status: "ACTIVE" },
      }),

      // Demographics: fetch athletes with birthDate and gender
      db.athlete.findMany({
        where: {
          organizationAthletes: { some: { organizationId: orgId, status: "ACTIVE" } },
        },
        select: {
          birthDate: true,
          gender: true,
        },
      }),

      // Distribution: athletes by level
      scopedDb.organizationAthlete.groupBy({
        by: ["level"],
        _count: { level: true },
        where: { status: "ACTIVE" },
        orderBy: { _count: { level: "desc" } },
      }),

      // Distribution: athletes by status
      scopedDb.organizationAthlete.groupBy({
        by: ["status"],
        _count: { status: true },
      }),

      // Enrollment trend: monthly enrollments for last 12 months
      db.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT
          to_char(e."createdAt", 'YYYY-MM') AS month,
          COUNT(*)::bigint AS count
        FROM "Enrollment" e
        INNER JOIN "Program" p ON e."programId" = p."id"
        WHERE p."organizationId" = ${orgId}
          AND e."createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY to_char(e."createdAt", 'YYYY-MM')
        ORDER BY month ASC
      `,
    ]);

    // Compute age buckets from birthDate
    const now = new Date();
    const ageBuckets: Record<string, number> = {
      "Under 6": 0,
      "6-12": 0,
      "13-17": 0,
      "18+": 0,
      "Unknown": 0,
    };

    const genderBuckets: Record<string, number> = {
      MALE: 0,
      FEMALE: 0,
      OTHER: 0,
      PREFER_NOT_TO_SAY: 0,
      UNKNOWN: 0,
    };

    for (const athlete of athletesWithDemographics) {
      // Age
      if (athlete.birthDate) {
        const age = Math.floor(
          (now.getTime() - new Date(athlete.birthDate).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        );
        if (age < 6) ageBuckets["Under 6"]++;
        else if (age <= 12) ageBuckets["6-12"]++;
        else if (age <= 17) ageBuckets["13-17"]++;
        else ageBuckets["18+"]++;
      } else {
        ageBuckets["Unknown"]++;
      }

      // Gender
      if (athlete.gender) {
        genderBuckets[athlete.gender]++;
      } else {
        genderBuckets["UNKNOWN"]++;
      }
    }

    return NextResponse.json({
      kpis: {
        totalAthletes,
        newAthletes,
        activePrograms,
        totalEnrollments,
        teamMembers,
      },
      demographics: {
        age: Object.entries(ageBuckets).map(([bucket, count]) => ({
          bucket,
          count,
        })),
        gender: Object.entries(genderBuckets).map(([gender, count]) => ({
          gender,
          count,
        })),
      },
      distribution: {
        byLevel: levelGroups.map((g) => ({
          level: g.level,
          count: g._count.level,
        })),
        byStatus: statusGroups.map((g) => ({
          status: g.status,
          count: g._count.status,
        })),
      },
      enrollmentTrend: enrollmentTrend.map((row) => ({
        month: row.month,
        count: Number(row.count),
      })),
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
