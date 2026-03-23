import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { createStore, createSweep } from "@/lib/adyen-platform"

/**
 * POST /api/organization/adyen-onboarding/finalize
 * Creates the Store and configures Sweep after verification passes.
 */
export async function POST() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const permissions = session.user.permissions || []
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: session.user.organizationId },
    })

    if (!account) {
      return NextResponse.json(
        { error: "Onboarding not started" },
        { status: 400 }
      )
    }

    if (account.onboardingStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: `Cannot finalize: current status is ${account.onboardingStatus}` },
        { status: 400 }
      )
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        name: true,
        slug: true,
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        phone: true,
      },
    })

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const updates: any = {}

    // Create Store (idempotent -- skip if already set)
    if (!account.storeId) {
      if (!org.phone) {
        return NextResponse.json(
          { error: "Organization phone number is missing. Please update your organization details before finalizing setup." },
          { status: 400 }
        )
      }

      // Format phone number to E.164 for Adyen if it's not already
      let formattedPhone = org.phone
      let cleaned = org.phone.replace(/[^\d+]/g, "")
      if (!cleaned.startsWith("+")) {
        cleaned = cleaned.length === 11 && cleaned.startsWith("1") ? `+${cleaned}` : `+1${cleaned}`
      }
      if (cleaned.length >= 10) {
        formattedPhone = cleaned
      } else {
        return NextResponse.json(
          { error: "Organization phone number is invalid. Please provide a valid phone number." },
          { status: 400 }
        )
      }

      // Adyen shopper statement must be alphanumeric/spaces and max 22 chars
      const sanitizedName = org.name.replace(/[^a-zA-Z0-9\s&,.\-_@]/g, "").substring(0, 22).trim()
      
      const store = await createStore({
        merchantId: process.env.ADYEN_PLATFORM_MERCHANT_ACCOUNT || "",
        description: org.name,
        shopperStatement: sanitizedName || "ClubRegistration",
        reference: `store-${org.slug}`,
        address: {
          country: org.country || "US",
          line1: org.street || "",
          city: org.city || "",
          stateOrProvince: org.stateProvince || "",
          postalCode: org.postalCode || "",
        },
        phoneNumber: formattedPhone,
      })

      updates.storeId = store.id
      updates.storeReference = store.reference
    }

    // Create Sweep -- need the transfer instrument from the account holder
    if (!account.sweepId && account.balanceAccountId && account.accountHolderId) {
      try {
        const transferInstrumentId = await findTransferInstrumentId(account.accountHolderId)

        if (transferInstrumentId) {
          const sweep = await createSweep(account.balanceAccountId, {
            counterparty: { transferInstrumentId },
            type: "push",
            schedule: { type: "daily" },
            priorities: ["regular"],
            currency: "USD",
          })

          updates.sweepId = sweep.id
          updates.transferInstrumentId = transferInstrumentId
        } else {
          console.warn("No transfer instrument found -- sweep creation skipped. Bank details may not be provided yet.")
        }
      } catch (error) {
        console.error("Sweep creation failed:", error)
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.adyenPlatformAccount.update({
        where: { id: account.id },
        data: updates,
      })
    }

    return NextResponse.json({
      storeId: updates.storeId || account.storeId,
      storeReference: updates.storeReference || account.storeReference,
      sweepId: updates.sweepId || account.sweepId,
      message: "Finalization complete",
    })
  } catch (error: any) {
    console.error("Finalization failed:", error)
    return NextResponse.json(
      { error: "Failed to finalize onboarding" },
      { status: 500 }
    )
  }
}

/**
 * Discover the transfer instrument ID from the account holder's balance account.
 * Transfer instruments are created during hosted onboarding when the user provides bank details.
 */
async function findTransferInstrumentId(
  accountHolderId: string
): Promise<string | null> {
  try {
    const { BalancePlatformAPI, Client } = require("@adyen/api-library")
    const client = new Client({
      apiKey: process.env.ADYEN_PLATFORM_API_KEY,
      environment:
        process.env.ADYEN_ENVIRONMENT?.toUpperCase() === "LIVE"
          ? "LIVE"
          : "TEST",
    })
    const configApi = new BalancePlatformAPI(client)

    // Get all balance accounts for this account holder
    const balanceAccounts =
      await configApi.AccountHoldersApi.getAllBalanceAccountsOfAccountHolder(
        accountHolderId
      )

    // Check each balance account for linked payment instruments
    for (const ba of balanceAccounts.balanceAccounts || []) {
      const instruments =
        await configApi.BalanceAccountsApi.getPaymentInstrumentsLinkedToBalanceAccount(
          ba.id
        )

      for (const pi of instruments.paymentInstruments || []) {
        if (pi.type === "bankAccount" && pi.id) {
          return pi.id
        }
      }
    }

    return null
  } catch (error) {
    console.error("Failed to find transfer instrument:", error)
    return null
  }
}
