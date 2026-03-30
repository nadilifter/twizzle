import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateUpcomingSeasons, expireSeasons } from "@/lib/services/season-renewal";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [generated, expired] = await Promise.all([generateUpcomingSeasons(), expireSeasons()]);

    const summary = {
      generatedSeasons: generated.length,
      expiredSeasons: expired.expiredCount,
      details: generated,
    };

    logger.info("Season cron completed", summary);
    return NextResponse.json(summary);
  } catch (error) {
    logger.error("Season cron failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
