import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeTokens } from "@/lib/qbo";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await db.qboConnection.findUnique({
      where: { organizationId: session.user.organizationId },
    });

    if (!connection) {
      return NextResponse.json({ error: "No QBO connection found" }, { status: 404 });
    }

    await revokeTokens(connection.id);

    await db.$transaction([
      db.qboSyncQueue.deleteMany({ where: { connectionId: connection.id } }),
      db.qboSyncMapping.deleteMany({ where: { connectionId: connection.id } }),
      db.qboAccountMapping.deleteMany({ where: { connectionId: connection.id } }),
      db.qboConnection.delete({ where: { id: connection.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[QBO Disconnect] Error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect QuickBooks" },
      { status: 500 }
    );
  }
}
