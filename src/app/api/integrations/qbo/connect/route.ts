import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { generateOAuthUrl, isQboConfigured } from "@/lib/qbo";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isQboConfigured()) {
      return NextResponse.json(
        { error: "QuickBooks integration is not configured" },
        { status: 503 }
      );
    }

    const state = Buffer.from(
      JSON.stringify({
        organizationId: session.user.organizationId,
        nonce: randomBytes(16).toString("hex"),
      })
    ).toString("base64url");

    const authUrl = generateOAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[QBO Connect] Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate QuickBooks connection" },
      { status: 500 }
    );
  }
}
