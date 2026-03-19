import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchXeroAccounts } from "@/lib/xero-discovery";

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
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "No active Xero connection" },
        { status: 404 }
      );
    }

    const accounts = await fetchXeroAccounts(connection.id);

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[Xero Accounts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Xero accounts" },
      { status: 500 }
    );
  }
}
