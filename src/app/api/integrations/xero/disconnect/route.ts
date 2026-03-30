import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeXeroTokens } from "@/lib/xero";

export async function POST() {
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

    await revokeXeroTokens(connection.id);

    await db.$transaction([
      db.accountingSyncQueue.deleteMany({ where: { connectionId: connection.id } }),
      db.accountingSyncMapping.deleteMany({ where: { connectionId: connection.id } }),
      db.accountingAccountMapping.deleteMany({ where: { connectionId: connection.id } }),
      db.accountingConnection.delete({ where: { id: connection.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Xero Disconnect] Error:", error);
    return NextResponse.json({ error: "Failed to disconnect Xero" }, { status: 500 });
  }
}
