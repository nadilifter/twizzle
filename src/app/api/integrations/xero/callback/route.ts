import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleXeroCallback, tokenSetToDbFields } from "@/lib/xero";
import { fetchXeroCompanyInfo } from "@/lib/xero-discovery";
import { verifySignedState } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("[Xero Callback] OAuth error:", error);
      return NextResponse.redirect(
        new URL("/dashboard/financials/integrations?xero_error=auth_denied", request.url)
      );
    }

    if (!state) {
      return NextResponse.redirect(
        new URL("/dashboard/financials/integrations?xero_error=missing_params", request.url)
      );
    }

    let organizationId: string;
    try {
      const verified = verifySignedState(state);
      organizationId = verified.organizationId;
    } catch {
      return NextResponse.redirect(
        new URL("/dashboard/financials/integrations?xero_error=invalid_state", request.url)
      );
    }

    const { tokenSet, tenantId, tenantName } = await handleXeroCallback(request.url);
    const dbFields = tokenSetToDbFields(tokenSet, tenantId);

    const connection = await db.accountingConnection.upsert({
      where: { organizationId_provider: { organizationId, provider: "XERO" } },
      create: {
        organizationId,
        provider: "XERO",
        ...dbFields,
        scope: "accounting.transactions accounting.contacts accounting.settings offline_access",
        companyName: tenantName,
        isActive: true,
        setupComplete: false,
      },
      update: {
        ...dbFields,
        scope: "accounting.transactions accounting.contacts accounting.settings offline_access",
        companyName: tenantName,
        isActive: true,
        setupComplete: false,
      },
    });

    fetchXeroCompanyInfo(connection.id).catch((err) =>
      console.error("[Xero Callback] Failed to fetch company info:", err)
    );

    return NextResponse.redirect(
      new URL("/dashboard/financials/integrations?xero_connected=true", request.url)
    );
  } catch (error) {
    console.error("[Xero Callback] Error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/financials/integrations?xero_error=exchange_failed", request.url)
    );
  }
}
