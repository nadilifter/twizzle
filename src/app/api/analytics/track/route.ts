import { NextRequest, NextResponse } from "next/server";
import { redis, visitorKeys, VISITOR_TTL_SECONDS, DeviceType } from "@/lib/redis";
import { db } from "@/lib/db";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/analytics/track
 * 
 * Track a unique visitor for an organization.
 * Uses Redis SADD for automatic deduplication.
 * 
 * This endpoint is designed for fire-and-forget tracking:
 * - No authentication required (public marketing sites)
 * - organizationId is derived server-side from the Host header subdomain
 * - Returns 204 No Content immediately
 * - Silently handles errors (analytics should never break the page)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkApiRateLimit(request, "analytics-track", { limit: 60, windowSeconds: 60 });
    if (rateLimitResponse) return rateLimitResponse;

    if (!redis) {
      return new NextResponse(null, { status: 204 });
    }

    // Derive organizationId from Host header subdomain
    const hostname = request.headers.get("host") || "";
    const subdomain = hostname.split(".")[0];
    if (!subdomain) {
      return new NextResponse(null, { status: 204 });
    }

    const siteConfig = await db.websiteConfig.findUnique({
      where: { subdomain },
      select: { organizationId: true },
    });

    if (!siteConfig?.organizationId) {
      return new NextResponse(null, { status: 204 });
    }

    const organizationId = siteConfig.organizationId;

    let body: { 
      visitorId?: string; 
      date?: string;
      deviceType?: string;
    };
    try {
      body = await request.json();
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    const { visitorId, date, deviceType } = body;

    if (!visitorId || !date) {
      return new NextResponse(null, { status: 204 });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new NextResponse(null, { status: 204 });
    }

    // Validate visitor ID format (should be UUID-like)
    if (visitorId.length < 8 || visitorId.length > 64) {
      return new NextResponse(null, { status: 204 });
    }

    // Validate and normalize device type (default to desktop)
    const normalizedDeviceType: DeviceType = 
      deviceType === "mobile" ? "mobile" : "desktop";

    // Add visitor to the device-specific daily set (SADD handles deduplication)
    const key = visitorKeys.dailyByDevice(organizationId, date, normalizedDeviceType);
    
    // Use pipeline for atomic operation with TTL
    await redis
      .pipeline()
      .sadd(key, visitorId)
      .expire(key, VISITOR_TTL_SECONDS)
      .exec();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Log error but don't expose to client
    console.error("[Analytics Track] Error:", error);
    return new NextResponse(null, { status: 204 });
  }
}

// Route segment config for App Router
// Note: Body size limits are handled differently in App Router
// For sendBeacon, the default limits are sufficient
