import { NextRequest, NextResponse } from "next/server";
import { processQboSyncQueue } from "@/lib/qbo-sync";
import { isQboConfigured } from "@/lib/qbo";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isQboConfigured()) {
      return NextResponse.json({
        skipped: true,
        reason: "QBO integration not configured",
      });
    }

    const result = await processQboSyncQueue();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[QBO Cron] Error processing sync queue:", error);
    return NextResponse.json(
      {
        error: "Failed to process sync queue",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
