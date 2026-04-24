import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizeOrgOnboarding } from "@/lib/adyen-onboarding-finalize";

/**
 * POST /api/organization/adyen-onboarding/finalize
 * Creates the Store and configures Sweep after verification passes.
 */
export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgId = session.user.organizationId;

    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: orgId, accountStatus: "ACTIVE" },
    });
    if (!account) {
      return NextResponse.json({ error: "Onboarding not started" }, { status: 400 });
    }
    if (account.onboardingStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: `Cannot finalize: current status is ${account.onboardingStatus}` },
        { status: 400 }
      );
    }

    const result = await finalizeOrgOnboarding(orgId);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.code === "PRECONDITION") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === "CONFIG_ERROR") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("Finalization failed:", error);
    return NextResponse.json({ error: "Failed to finalize onboarding" }, { status: 500 });
  }
}
