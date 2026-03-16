import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateOnboardingLink } from "@/lib/adyen-platform"
import { getWebhookBaseUrl } from "@/lib/webhooks"

/**
 * POST /api/organization/adyen-onboarding/link
 * Generates a hosted onboarding link for the current organization.
 * Redirects back to the onboarding dashboard page after completion.
 */
export async function POST() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const permissions = session.user.permissions || []
    if (
      !permissions.includes("*") &&
      !permissions.includes("financials.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: session.user.organizationId },
    })

    if (!account) {
      return NextResponse.json(
        { error: "Onboarding not started. Initiate onboarding first." },
        { status: 400 }
      )
    }

    if (!account.legalEntityId) {
      return NextResponse.json(
        { error: "Legal entity not created" },
        { status: 400 }
      )
    }

    const baseUrl = getWebhookBaseUrl()
    const redirectUrl = `${baseUrl}/dashboard/financials/onboarding`

    const link = await generateOnboardingLink(
      account.legalEntityId,
      redirectUrl
    )

    await db.adyenPlatformAccount.update({
      where: { id: account.id },
      data: { onboardingStatus: "IN_PROGRESS" },
    })

    return NextResponse.json({ url: link.url })
  } catch (error: any) {
    console.error("Failed to generate onboarding link:", error)
    return NextResponse.json(
      { error: "Failed to generate onboarding link" },
      { status: 500 }
    )
  }
}
