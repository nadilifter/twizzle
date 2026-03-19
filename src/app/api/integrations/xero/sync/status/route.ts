import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await db.accountingConnection.findUnique({
      where: {
        organizationId_provider: {
          organizationId: session.user.organizationId,
          provider: "XERO",
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "No Xero connection found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const [queueCounts, recentLogs] = await Promise.all([
      db.accountingSyncQueue.groupBy({
        by: ["status"],
        where: { connectionId: connection.id },
        _count: true,
      }),
      db.accountingSyncLog.findMany({
        where: { connectionId: connection.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          entityType: true,
          uplifterEntityId: true,
          action: true,
          status: true,
          externalEntityId: true,
          errorMessage: true,
          durationMs: true,
          createdAt: true,
        },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const g of queueCounts) {
      counts[g.status] = g._count;
    }

    return NextResponse.json({
      queue: {
        pending: counts.PENDING || 0,
        processing: counts.PROCESSING || 0,
        completed: counts.COMPLETED || 0,
        failed: counts.FAILED || 0,
      },
      recentLogs,
      lastSyncAt: connection.lastSyncAt,
    });
  } catch (error) {
    console.error("[Xero Sync Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
