import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isTwilioConfigured } from "@/lib/twilio";
import { executeSmsCampaign } from "@/lib/sms-campaign-service";
import { logger } from "@/lib/logger";
import { startCronMonitoring, endCronMonitoring } from "@/lib/cron-utils";

/**
 * SMS Scheduled Campaign Cron Endpoint
 *
 * Picks up campaigns with status SCHEDULED whose scheduledAt has passed
 * and executes them. Designed to run every minute.
 *
 * Schedule: Every minute (* * * * *)
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  let checkInId: string | undefined;
  try {
    if (!CRON_SECRET) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    checkInId = startCronMonitoring("sms-campaigns");

    if (!isTwilioConfigured()) {
      await endCronMonitoring("sms-campaigns", checkInId, "ok");
      return NextResponse.json({
        success: true,
        message: "Twilio not configured — skipping",
        campaignsSent: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const now = new Date();

    const dueCampaigns = await db.smsCampaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    });

    if (dueCampaigns.length === 0) {
      await endCronMonitoring("sms-campaigns", checkInId, "ok");
      return NextResponse.json({
        success: true,
        campaignsSent: 0,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("Processing scheduled SMS campaigns", {
      count: dueCampaigns.length,
      ids: dueCampaigns.map((c) => c.id),
    });

    const results: Array<{ id: string; name: string; status: string; error?: string }> = [];

    for (const campaign of dueCampaigns) {
      try {
        await executeSmsCampaign(campaign.id);
        results.push({ id: campaign.id, name: campaign.name, status: "sent" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed to execute scheduled campaign ${campaign.id}:`, error);

        await db.smsCampaign
          .update({
            where: { id: campaign.id },
            data: { status: "FAILED" },
          })
          .catch(() => {});

        results.push({ id: campaign.id, name: campaign.name, status: "failed", error: message });
      }
    }

    await endCronMonitoring("sms-campaigns", checkInId, "ok");

    return NextResponse.json({
      success: true,
      campaignsSent: results.filter((r) => r.status === "sent").length,
      campaignsFailed: results.filter((r) => r.status === "failed").length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await endCronMonitoring("sms-campaigns", checkInId, "error");
    console.error("Error in sms-campaigns cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process scheduled campaigns",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
