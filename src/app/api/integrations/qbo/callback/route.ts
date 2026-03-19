import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeCodeForTokens, tokenToDbFields } from "@/lib/qbo";
import { fetchCompanyInfo } from "@/lib/qbo-discovery";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const realmId = searchParams.get("realmId");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("[QBO Callback] OAuth error:", error);
      return NextResponse.redirect(
        new URL("/dashboard/financials/integrations?qbo_error=auth_denied", request.url)
      );
    }

    if (!code || !realmId || !state) {
      return NextResponse.redirect(
        new URL("/dashboard/financials/integrations?qbo_error=missing_params", request.url)
      );
    }

    let stateData: { organizationId: string };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    } catch {
      return NextResponse.redirect(
        new URL("/dashboard/financials/integrations?qbo_error=invalid_state", request.url)
      );
    }

    const { organizationId } = stateData;
    if (!organizationId) {
      return NextResponse.redirect(
        new URL("/dashboard/financials/integrations?qbo_error=invalid_state", request.url)
      );
    }

    const token = await exchangeCodeForTokens(code, realmId);
    const dbFields = tokenToDbFields(token);

    const connection = await db.qboConnection.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...dbFields,
        scope: "com.intuit.quickbooks.accounting",
        isActive: true,
        setupComplete: false,
      },
      update: {
        ...dbFields,
        scope: "com.intuit.quickbooks.accounting",
        isActive: true,
        setupComplete: false,
      },
    });

    // Fetch company info in the background (non-blocking)
    fetchCompanyInfo(connection.id).catch((err) =>
      console.error("[QBO Callback] Failed to fetch company info:", err)
    );

    return NextResponse.redirect(
      new URL("/dashboard/financials/integrations?qbo_connected=true", request.url)
    );
  } catch (error) {
    console.error("[QBO Callback] Error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/financials/integrations?qbo_error=exchange_failed", request.url)
    );
  }
}
