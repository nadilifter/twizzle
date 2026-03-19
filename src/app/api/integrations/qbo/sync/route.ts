import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueFullSync } from "@/lib/qbo-queue";

// POST - trigger a manual full sync
export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await db.qboConnection.findUnique({
      where: { organizationId: session.user.organizationId },
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "No active QBO connection" },
        { status: 404 }
      );
    }

    if (!connection.setupComplete) {
      return NextResponse.json(
        { error: "Account mapping setup not complete" },
        { status: 400 }
      );
    }

    const result = await enqueueFullSync(session.user.organizationId);

    return NextResponse.json({
      success: true,
      queued: result.queued,
      message: `Queued ${result.queued} items for sync. They will be processed within 15 minutes.`,
    });
  } catch (error) {
    console.error("[QBO Sync Trigger] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
