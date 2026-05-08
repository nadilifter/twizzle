import { NextRequest, NextResponse } from "next/server";
import { generateUpcomingSeasons, expireSeasons } from "@/lib/services/season-renewal";
import { logger } from "@/lib/logger";
import { verifyCronSecret, startCronMonitoring, endCronMonitoring } from "@/lib/cron-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  let checkInId: string | undefined;
  try {
    if (!process.env.CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    checkInId = startCronMonitoring("seasons");

    const [generated, expired] = await Promise.all([generateUpcomingSeasons(), expireSeasons()]);

    const summary = {
      generatedSeasons: generated.length,
      expiredSeasons: expired.expiredCount,
      details: generated,
    };

    logger.info("Season cron completed", summary);
    await endCronMonitoring("seasons", checkInId, "ok");
    return NextResponse.json(summary);
  } catch (error) {
    await endCronMonitoring("seasons", checkInId, "error");
    logger.error("Season cron failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
