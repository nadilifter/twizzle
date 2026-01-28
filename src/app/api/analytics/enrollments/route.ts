import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

interface EnrollmentMetricsResponse {
  newThisPeriod: number;
  newPreviousPeriod: number;
  percentChange: number | null;
  activeTotal: number;
  activePreviousTotal: number;
  growthRate: number | null;
}

/**
 * GET /api/analytics/enrollments
 * 
 * Fetch enrollment metrics for the authenticated user's organization.
 * Returns new enrollment counts and growth rate comparisons.
 * 
 * Query parameters:
 * - periodDays: Number of days for the period (defaults to 30)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const organizationId = session.user.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      );
    }

    // Parse period from query params (default 30 days)
    const searchParams = request.nextUrl.searchParams;
    const periodDays = parseInt(searchParams.get("periodDays") || "30", 10);

    // Calculate date boundaries
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodDays);
    
    const previousPeriodEnd = new Date(periodStart);
    const previousPeriodStart = new Date(previousPeriodEnd);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);

    // Build organization scope filter
    const orgScope = {
      athlete: {
        OR: [
          // Athletes directly linked to organization
          { organizationId },
          // Athletes linked via guardians -> families -> organization
          {
            guardians: {
              some: {
                family: {
                  organizationId,
                },
              },
            },
          },
        ],
      },
    };

    // Execute all queries in parallel
    const [
      newThisPeriod,
      newPreviousPeriod,
      activeTotal,
      activePreviousTotal,
    ] = await Promise.all([
      // New enrollments in current period
      db.enrollment.count({
        where: {
          ...orgScope,
          createdAt: { gte: periodStart },
        },
      }),

      // New enrollments in previous period
      db.enrollment.count({
        where: {
          ...orgScope,
          createdAt: {
            gte: previousPeriodStart,
            lt: periodStart,
          },
        },
      }),

      // Total active enrollments now
      db.enrollment.count({
        where: {
          ...orgScope,
          status: "ACTIVE",
        },
      }),

      // Active enrollments at start of current period
      // (enrollments that were active before period start and not cancelled/completed before then)
      db.enrollment.count({
        where: {
          ...orgScope,
          createdAt: { lt: periodStart },
          status: "ACTIVE",
        },
      }),
    ]);

    // Calculate percentage change for new enrollments
    let percentChange: number | null = null;
    if (newPreviousPeriod > 0) {
      percentChange = Math.round(
        ((newThisPeriod - newPreviousPeriod) / newPreviousPeriod) * 100
      );
    } else if (newThisPeriod > 0) {
      percentChange = 100; // Any enrollments when previous was 0 = +100%
    }

    // Calculate growth rate (active enrollment change)
    let growthRate: number | null = null;
    if (activePreviousTotal > 0) {
      growthRate = Math.round(
        ((activeTotal - activePreviousTotal) / activePreviousTotal) * 100
      );
    } else if (activeTotal > 0) {
      growthRate = 100; // Any active when previous was 0 = +100%
    }

    const response: EnrollmentMetricsResponse = {
      newThisPeriod,
      newPreviousPeriod,
      percentChange,
      activeTotal,
      activePreviousTotal,
      growthRate,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Enrollments] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollment metrics" },
      { status: 500 }
    );
  }
}
