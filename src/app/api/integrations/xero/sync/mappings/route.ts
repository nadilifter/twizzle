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
      return NextResponse.json({ error: "No Xero connection found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      connectionId: connection.id,
    };
    if (entityType) {
      where.entityType = entityType;
    }

    const [mappings, total] = await Promise.all([
      db.accountingSyncMapping.findMany({
        where,
        orderBy: { lastSyncedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.accountingSyncMapping.count({ where }),
    ]);

    return NextResponse.json({ mappings, total });
  } catch (error) {
    console.error("[Xero Sync Mappings] Error:", error);
    return NextResponse.json({ error: "Failed to get sync mappings" }, { status: 500 });
  }
}
