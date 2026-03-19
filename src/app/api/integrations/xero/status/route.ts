import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
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
      select: {
        id: true,
        tenantId: true,
        companyName: true,
        isActive: true,
        setupComplete: true,
        lastSyncAt: true,
        createdAt: true,
        _count: {
          select: {
            syncQueue: { where: { status: "PENDING" } },
            syncLogs: { where: { status: "FAILED" } },
            accountMappings: true,
          },
        },
      },
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
        setupComplete: false,
      });
    }

    return NextResponse.json({
      connected: connection.isActive,
      setupComplete: connection.setupComplete,
      companyName: connection.companyName,
      tenantId: connection.tenantId,
      lastSyncAt: connection.lastSyncAt,
      connectedAt: connection.createdAt,
      pendingSync: connection._count.syncQueue,
      failedSync: connection._count.syncLogs,
      mappingsCount: connection._count.accountMappings,
    });
  } catch (error) {
    console.error("[Xero Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get Xero status" },
      { status: 500 }
    );
  }
}
