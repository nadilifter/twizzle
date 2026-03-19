import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchChartOfAccounts } from "@/lib/qbo-discovery";

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
          provider: "QBO",
        },
      },
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "No active QBO connection" },
        { status: 404 }
      );
    }

    const accounts = await fetchChartOfAccounts(connection.id);

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[QBO Accounts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch QBO accounts" },
      { status: 500 }
    );
  }
}
