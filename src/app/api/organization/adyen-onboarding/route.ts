import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  createLegalEntity,
  createBusinessLine,
  createAccountHolder,
  createBalanceAccount,
  getAccountHolder,
  isPlatformConfigured,
} from "@/lib/adyen-platform"
import {
  deriveOnboardingStatus,
  summarizeVerification,
} from "@/lib/adyen-onboarding-status"
import { getSubdomainUrl } from "@/lib/env-domains"

/**
 * GET /api/organization/adyen-onboarding
 * Returns the current organization's Adyen platform onboarding status.
 */
export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: session.user.organizationId },
    })

    // Live-sync: if the account exists and isn't already terminal, reconcile
    // with Adyen's API so the status is accurate even without webhooks.
    if (
      account?.accountHolderId &&
      account.onboardingStatus !== "VERIFIED" &&
      isPlatformConfigured()
    ) {
      try {
        const liveHolder = await getAccountHolder(account.accountHolderId)
        const onboardingStatus = deriveOnboardingStatus(liveHolder)
        const verificationStatus = summarizeVerification(liveHolder)
        const capabilities = liveHolder.capabilities || {}

        if (
          onboardingStatus !== account.onboardingStatus ||
          JSON.stringify(capabilities) !== JSON.stringify(account.capabilities)
        ) {
          account = await db.adyenPlatformAccount.update({
            where: { id: account.id },
            data: { onboardingStatus, verificationStatus, capabilities },
          })
        }
      } catch {
        // Best-effort: if Adyen API is unreachable, fall back to stored status
      }
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        phone: true,
        taxRate: true,
        taxEnabled: true,
      },
    })

    return NextResponse.json({
      organization: org,
      account: account
        ? {
            onboardingStatus: account.onboardingStatus,
            verificationStatus: account.verificationStatus,
            capabilities: account.capabilities,
            hasStore: !!account.storeId,
            hasSweep: !!account.sweepId,
            legalEntityId: account.legalEntityId,
            accountHolderId: account.accountHolderId,
            balanceAccountId: account.balanceAccountId,
          }
        : null,
    })
  } catch (error) {
    console.error("Failed to fetch onboarding status:", error)
    return NextResponse.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organization/adyen-onboarding
 * Initiates Adyen platform onboarding: creates Legal Entity, Business Line,
 * Account Holder, and Balance Account.
 */
export async function POST(request: NextRequest) {
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

    if (!isPlatformConfigured()) {
      return NextResponse.json(
        { error: "Adyen platform is not configured" },
        { status: 503 }
      )
    }

    const orgId = session.user.organizationId

    // Check if already onboarded
    const existing = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: orgId },
    })
    if (existing) {
      return NextResponse.json({
        account: {
          onboardingStatus: existing.onboardingStatus,
          verificationStatus: existing.verificationStatus,
          legalEntityId: existing.legalEntityId,
          accountHolderId: existing.accountHolderId,
          balanceAccountId: existing.balanceAccountId,
        },
        message: "Onboarding already initiated",
      })
    }

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        phone: true,
        email: true,
        websiteConfig: { select: { subdomain: true } },
      },
    })

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    if (!org.street || !org.city || !org.stateProvince || !org.postalCode || !org.country || !org.phone) {
      return NextResponse.json(
        { error: "Organization address or phone number is incomplete. Please update your organization details before onboarding." },
        { status: 400 }
      )
    }

    if (org.stateProvince.length > 2 || org.country.length > 2) {
      return NextResponse.json(
        { error: "State/Province and Country must be 2-letter codes. Please edit your organization address to fix this." },
        { status: 400 }
      )
    }

    // Read optional override from request body
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // No body is fine
    }

    // Step 1: Create Legal Entity
    const legalEntity = await createLegalEntity({
      type: "organization",
      organization: {
        legalName: org.name,
        registeredAddress: {
          street: org.street,
          city: org.city,
          stateOrProvince: org.stateProvince,
          postalCode: org.postalCode,
          country: org.country,
        },
      },
    })

    // Step 2: Create Business Line
    const subdomain = org.websiteConfig?.subdomain || org.slug
    const webAddress = getSubdomainUrl(subdomain)
    let businessLine: { id: string } | null = null
    try {
      businessLine = await createBusinessLine({
        legalEntityId: legalEntity.id,
        industryCode: body.industryCode || "4431A",
        service: "paymentProcessing",
        salesChannels: ["eCommerce"],
        webData: [{ webAddress }],
      })
    } catch (error) {
      console.error("Business line creation failed, continuing:", error)
    }

    // Step 3: Create Account Holder
    const accountHolder = await createAccountHolder({
      legalEntityId: legalEntity.id,
      description: org.name,
    })

    // Step 4: Create Balance Account
    const balanceAccount = await createBalanceAccount({
      accountHolderId: accountHolder.id,
      description: `${org.name} - Primary`,
    })

    // Save to database
    const account = await db.adyenPlatformAccount.create({
      data: {
        organizationId: org.id,
        legalEntityId: legalEntity.id,
        businessLineId: businessLine?.id || null,
        accountHolderId: accountHolder.id,
        balanceAccountId: balanceAccount.id,
        onboardingStatus: "PENDING_HOSTED",
      },
    })

    return NextResponse.json({
      account: {
        onboardingStatus: account.onboardingStatus,
        legalEntityId: account.legalEntityId,
        accountHolderId: account.accountHolderId,
        balanceAccountId: account.balanceAccountId,
        businessLineId: account.businessLineId,
      },
      message: "Onboarding initiated successfully",
    })
  } catch (error: any) {
    console.error("Onboarding initiation failed:", error)
    return NextResponse.json(
      { error: "Onboarding initiation failed" },
      { status: 500 }
    )
  }
}
