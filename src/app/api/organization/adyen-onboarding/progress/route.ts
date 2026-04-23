import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/organization/adyen-onboarding/progress
 * Persists pre-onboarding stepper gate confirmations so the user can resume the
 * flow after refresh or across sessions, before the AdyenPlatformAccount exists.
 *
 * Body: { legalNameConfirmed?: boolean; feeAcknowledged?: boolean; agreementAccepted?: boolean }
 * For each provided key: true sets the timestamp to now(), false clears it to null.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { legalNameConfirmed, feeAcknowledged, agreementAccepted } = body as {
      legalNameConfirmed?: boolean;
      feeAcknowledged?: boolean;
      agreementAccepted?: boolean;
    };

    const data: {
      onboardingLegalNameConfirmedAt?: Date | null;
      onboardingFeeAcknowledgedAt?: Date | null;
      onboardingAgreementAcceptedAt?: Date | null;
    } = {};
    const now = new Date();

    if (typeof legalNameConfirmed === "boolean") {
      data.onboardingLegalNameConfirmedAt = legalNameConfirmed ? now : null;
    }
    if (typeof feeAcknowledged === "boolean") {
      data.onboardingFeeAcknowledgedAt = feeAcknowledged ? now : null;
    }
    if (typeof agreementAccepted === "boolean") {
      data.onboardingAgreementAcceptedAt = agreementAccepted ? now : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No progress fields provided" }, { status: 400 });
    }

    const updated = await db.organization.update({
      where: { id: session.user.organizationId },
      data,
      select: {
        onboardingLegalNameConfirmedAt: true,
        onboardingFeeAcknowledgedAt: true,
        onboardingAgreementAcceptedAt: true,
      },
    });

    return NextResponse.json({ progress: updated });
  } catch (error) {
    console.error("Failed to update onboarding progress:", error);
    return NextResponse.json({ error: "Failed to update onboarding progress" }, { status: 500 });
  }
}
