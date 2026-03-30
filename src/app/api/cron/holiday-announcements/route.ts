import { NextRequest, NextResponse } from "next/server";
import {
  generateHolidayAnnouncements,
  archiveExpiredHolidayAnnouncements,
} from "@/lib/services/holiday-announcements";

export const dynamic = "force-dynamic";

/**
 * Holiday Announcements Cron
 *
 * Daily job that:
 * 1. Generates announcements for holidays coming up within 7 days
 * 2. Archives announcements for holidays that have already passed
 *
 * Schedule: Daily at 8:00 AM UTC ("0 8 * * *")
 *
 * Trigger methods:
 * - Local: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/holiday-announcements
 * - Vercel: Configured in vercel.json
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const generated = await generateHolidayAnnouncements();
    const archived = await archiveExpiredHolidayAnnouncements();

    return NextResponse.json({
      success: true,
      generated: {
        created: generated.created,
        orgsProcessed: generated.orgsProcessed,
      },
      archived: archived.archived,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in holiday-announcements cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process holiday announcements",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
