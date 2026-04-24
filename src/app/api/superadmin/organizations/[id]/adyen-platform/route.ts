import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccountHolder, isPlatformConfigured } from "@/lib/adyen-platform";
import { deriveOnboardingStatus, summarizeVerification } from "@/lib/adyen-onboarding-status";
import { finalizeOrgOnboarding } from "@/lib/adyen-onboarding-finalize";

/**
 * GET /api/superadmin/organizations/[id]/adyen-platform
 * Returns the Adyen platform account for a given organization (superadmin only).
 * Live-syncs with Adyen when the account isn't already verified.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    let account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: id },
    });

    if (
      account?.accountHolderId &&
      account.onboardingStatus !== "VERIFIED" &&
      isPlatformConfigured()
    ) {
      try {
        const liveHolder = await getAccountHolder(account.accountHolderId);
        const onboardingStatus = deriveOnboardingStatus(liveHolder);
        const verificationStatus = summarizeVerification(liveHolder);
        const capabilities = liveHolder.capabilities || {};

        if (
          onboardingStatus !== account.onboardingStatus ||
          JSON.stringify(capabilities) !== JSON.stringify(account.capabilities)
        ) {
          account = await db.adyenPlatformAccount.update({
            where: { id: account.id },
            data: { onboardingStatus, verificationStatus, capabilities },
          });
        }
      } catch {
        // Best-effort: fall back to stored status
      }
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Failed to fetch Adyen platform account:", error);
    return NextResponse.json({ error: "Failed to fetch Adyen platform account" }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/organizations/[id]/adyen-platform
 * Triggers finalization (store + split config + payment methods + sweep) for any org.
 * Superadmin only. Safe to call multiple times — finalize is idempotent.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await finalizeOrgOnboarding(id);
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
    console.error("Superadmin finalization failed:", error);
    return NextResponse.json({ error: "Failed to finalize onboarding" }, { status: 500 });
  }
}
