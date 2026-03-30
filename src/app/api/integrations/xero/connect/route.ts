import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { generateXeroConsentUrl, isXeroConfigured } from "@/lib/xero";
import { createSignedState } from "@/lib/oauth-state";
import { checkFeatureGate } from "@/lib/feature-resolver";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const gate = await checkFeatureGate(organizationId, "accountingIntegrations");
    if (gate) return gate;

    if (!isXeroConfigured()) {
      return NextResponse.json({ error: "Xero integration is not configured" }, { status: 503 });
    }

    const state = createSignedState(organizationId);
    const authUrl = await generateXeroConsentUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[Xero Connect] Error:", error);
    return NextResponse.json({ error: "Failed to initiate Xero connection" }, { status: 500 });
  }
}
