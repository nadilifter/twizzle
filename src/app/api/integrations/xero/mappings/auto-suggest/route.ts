import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoSuggestXeroMappings } from "@/lib/xero-discovery";

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

    if (!connection || !connection.isActive) {
      return NextResponse.json({ error: "No active Xero connection" }, { status: 404 });
    }

    const suggestions = await autoSuggestXeroMappings(connection.id, session.user.organizationId);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("[Xero Auto-Suggest] Error:", error);
    return NextResponse.json({ error: "Failed to generate mapping suggestions" }, { status: 500 });
  }
}
