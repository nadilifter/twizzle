import { NextRequest, NextResponse } from "next/server";
import { processQboSyncQueue } from "@/lib/qbo-sync";
import { processXeroSyncQueue } from "@/lib/xero-sync";
import { isQboConfigured } from "@/lib/qbo";
import { isXeroConfigured } from "@/lib/xero";
import { startCronMonitoring, endCronMonitoring } from "@/lib/cron-utils";

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

    checkInId = startCronMonitoring("accounting-sync");

    const results: Record<string, any> = {};

    if (isQboConfigured()) {
      results.qbo = await processQboSyncQueue();
    } else {
      results.qbo = { skipped: true, reason: "QBO not configured" };
    }

    if (isXeroConfigured()) {
      results.xero = await processXeroSyncQueue();
    } else {
      results.xero = { skipped: true, reason: "Xero not configured" };
    }

    await endCronMonitoring("accounting-sync", checkInId, "ok");

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await endCronMonitoring("accounting-sync", checkInId, "error");
    console.error("[Accounting Cron] Error processing sync queue:", error);
    return NextResponse.json({ error: "Failed to process sync queue" }, { status: 500 });
  }
}
