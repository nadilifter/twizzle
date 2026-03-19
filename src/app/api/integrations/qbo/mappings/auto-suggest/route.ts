import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoSuggestMappings } from "@/lib/qbo-discovery";

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

    const suggestions = await autoSuggestMappings(
      connection.id,
      session.user.organizationId
    );

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("[QBO Auto-Suggest] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate mapping suggestions" },
      { status: 500 }
    );
  }
}
