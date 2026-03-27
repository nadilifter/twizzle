import { NextRequest, NextResponse } from "next/server";
import { sendHolidayReminderEmails } from "@/lib/services/holiday-announcements";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Holiday Reminder Emails Cron
 *
 * Daily job that emails org admins about upcoming holidays within 7 days.
 * Processes holidays in batches; progress is committed per-holiday so the
 * next run automatically resumes from where a previous run timed out.
 *
 * Schedule: Daily at 12:00 PM UTC ("0 12 * * *")
 *
 * Trigger methods:
 * - Local: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/holiday-reminders
 * - Vercel: Configured in vercel.json
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await sendHolidayReminderEmails();

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      orgsProcessed: result.orgsProcessed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in holiday-reminders cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send holiday reminder emails",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
