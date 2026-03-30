import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { redis, visitorKeys, formatDateKey } from "@/lib/redis";

interface DailyVisitorCount {
  date: string;
  desktop: number;
  mobile: number;
  total: number;
}

interface VisitorMetricsResponse {
  daily: DailyVisitorCount[];
  total: number;
  totalDesktop: number;
  totalMobile: number;
  today: number;
  todayDesktop: number;
  todayMobile: number;
  yesterday: number;
  percentChange: number | null;
}

/**
 * GET /api/analytics/visitors
 *
 * Fetch visitor metrics for the authenticated user's organization.
 * Returns daily breakdown by device type (mobile vs desktop).
 *
 * Query parameters:
 * - startDate: YYYY-MM-DD (defaults to 7 days ago)
 * - endDate: YYYY-MM-DD (defaults to today)
 * - organizationId: optional override (for super admins)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Redis is configured
    if (!redis) {
      return NextResponse.json(
        {
          daily: [],
          total: 0,
          totalDesktop: 0,
          totalMobile: 0,
          today: 0,
          todayDesktop: 0,
          todayMobile: 0,
          yesterday: 0,
          percentChange: null,
          error: "Analytics not configured",
        },
        { status: 200 }
      );
    }

    // Get organization ID from session or query params
    const searchParams = request.nextUrl.searchParams;
    const queryOrgId = searchParams.get("organizationId"); // tenant-isolation-ok: superadmin-only override, guarded by isSuperAdmin check below

    // Allow super admins to query any org, otherwise use session org
    const organizationId =
      session.user.isSuperAdmin && queryOrgId ? queryOrgId : session.user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Parse date range
    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(defaultStartDate.getDate() - 6); // Last 7 days including today

    const startDateStr = searchParams.get("startDate") || formatDateKey(defaultStartDate);
    const endDateStr = searchParams.get("endDate") || formatDateKey(today);

    // Validate date formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
    }

    // Generate list of dates in range
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const dates: string[] = [];

    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(formatDateKey(current));
      current.setDate(current.getDate() + 1);
    }

    // Fetch visitor counts for each date and device type using pipeline
    const pipeline = redis.pipeline();
    for (const date of dates) {
      // Fetch desktop count
      pipeline.scard(visitorKeys.desktop(organizationId, date));
      // Fetch mobile count
      pipeline.scard(visitorKeys.mobile(organizationId, date));
      // Also check legacy key (for backward compatibility with old data)
      pipeline.scard(visitorKeys.daily(organizationId, date));
    }

    const results = await pipeline.exec();

    // Build response - results are in order: desktop, mobile, legacy for each date
    const daily: DailyVisitorCount[] = dates.map((date, index) => {
      const baseIndex = index * 3;
      const desktop = (results[baseIndex] as number) || 0;
      const mobile = (results[baseIndex + 1] as number) || 0;
      const legacy = (results[baseIndex + 2] as number) || 0;

      // If we have device-specific data, use it; otherwise fall back to legacy
      const hasDeviceData = desktop > 0 || mobile > 0;

      if (hasDeviceData) {
        return {
          date,
          desktop,
          mobile,
          total: desktop + mobile,
        };
      } else {
        // Legacy data - split roughly 60/40 desktop/mobile for display
        return {
          date,
          desktop: Math.round(legacy * 0.6),
          mobile: Math.round(legacy * 0.4),
          total: legacy,
        };
      }
    });

    const total = daily.reduce((sum, d) => sum + d.total, 0);
    const totalDesktop = daily.reduce((sum, d) => sum + d.desktop, 0);
    const totalMobile = daily.reduce((sum, d) => sum + d.mobile, 0);

    // Get today and yesterday counts for comparison
    const todayStr = formatDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateKey(yesterday);

    const todayData = daily.find((d) => d.date === todayStr);
    const todayCount = todayData?.total || 0;
    const todayDesktop = todayData?.desktop || 0;
    const todayMobile = todayData?.mobile || 0;
    const yesterdayCount = daily.find((d) => d.date === yesterdayStr)?.total || 0;

    // Calculate percent change
    let percentChange: number | null = null;
    if (yesterdayCount > 0) {
      percentChange = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
    } else if (todayCount > 0) {
      percentChange = 100; // Any visitors when yesterday was 0 = +100%
    }

    const response: VisitorMetricsResponse = {
      daily,
      total,
      totalDesktop,
      totalMobile,
      today: todayCount,
      todayDesktop,
      todayMobile,
      yesterday: yesterdayCount,
      percentChange,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Analytics Visitors] Error:", error);
    return NextResponse.json({ error: "Failed to fetch visitor metrics" }, { status: 500 });
  }
}
