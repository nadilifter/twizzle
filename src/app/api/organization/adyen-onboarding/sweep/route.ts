import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSweep } from "@/lib/adyen-platform";

const VALID_SCHEDULES = ["daily", "weekly", "monthly"] as const;
type PayoutSchedule = (typeof VALID_SCHEDULES)[number];

/**
 * PATCH /api/organization/adyen-onboarding/sweep
 * Updates the Adyen sweep schedule for the org's balance account.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { schedule } = body;

    if (!VALID_SCHEDULES.includes(schedule)) {
      return NextResponse.json(
        { error: "Invalid schedule. Must be one of: daily, weekly, monthly" },
        { status: 400 }
      );
    }

    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: orgId, accountStatus: "ACTIVE" },
    });

    if (!account) {
      return NextResponse.json({ error: "Onboarding not started" }, { status: 400 });
    }

    if (account.onboardingStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: "Payout schedule can only be changed after onboarding is verified" },
        { status: 400 }
      );
    }

    if (!account.sweepId || !account.balanceAccountId) {
      return NextResponse.json(
        { error: "No sweep configured yet. Complete finalization first." },
        { status: 400 }
      );
    }

    await updateSweep(account.balanceAccountId, account.sweepId, {
      type: schedule as PayoutSchedule,
    });

    await db.adyenPlatformAccount.update({
      where: { organizationId: orgId, id: account.id },
      data: { payoutSchedule: schedule },
    });

    return NextResponse.json({ payoutSchedule: schedule });
  } catch (error: any) {
    console.error("Failed to update sweep schedule:", error);
    return NextResponse.json({ error: "Failed to update payout schedule" }, { status: 500 });
  }
}
