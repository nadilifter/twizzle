import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { 
  verifyWebhookSignature, 
  parseRecurringTokenWebhook 
} from "@/lib/adyen"

/**
 * POST /api/webhooks/adyen-recurring
 * 
 * Handles Adyen webhook notifications for recurring token events:
 * - RECURRING_CONTRACT: New token created
 * - RECURRING_CONTRACT_UPDATED: Token updated (e.g., card details changed)
 * - RECURRING_CONTRACT_DISABLED: Token disabled/deleted
 * - AUTHORISATION: Payment authorized (can contain token info)
 * 
 * Configure this endpoint in Adyen Customer Area:
 * Account > Webhooks > Add webhook
 */

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text()
    
    // Verify HMAC signature (if ADYEN_HMAC_KEY is configured)
    const hmacSignature = request.headers.get("hmac-signature") || ""
    if (process.env.ADYEN_WEBHOOK_HMAC_KEY && hmacSignature) {
      const isValid = verifyWebhookSignature(body, hmacSignature)
      if (!isValid) {
        console.error("Invalid webhook signature")
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    }

    // Parse the webhook notification
    const tokenData = parseRecurringTokenWebhook(body)
    
    if (!tokenData) {
      console.error("Failed to parse webhook notification")
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 })
    }

    console.log(`Processing Adyen webhook: ${tokenData.eventCode}`, {
      shopperReference: tokenData.shopperReference,
      storedPaymentMethodId: tokenData.storedPaymentMethodId,
      success: tokenData.success,
    })

    // Handle different event types
    switch (tokenData.eventCode) {
      case "RECURRING_CONTRACT":
      case "AUTHORISATION":
        // New token created or payment with token
        if (tokenData.success && tokenData.storedPaymentMethodId) {
          await handleTokenCreated(tokenData)
        }
        break

      case "RECURRING_CONTRACT_UPDATED":
        // Token updated (e.g., card details changed by issuer)
        if (tokenData.success && tokenData.storedPaymentMethodId) {
          await handleTokenUpdated(tokenData)
        }
        break

      case "RECURRING_CONTRACT_DISABLED":
        // Token disabled/deleted
        if (tokenData.storedPaymentMethodId) {
          await handleTokenDisabled(tokenData)
        }
        break

      default:
        console.log(`Unhandled event type: ${tokenData.eventCode}`)
    }

    // Always return [accepted] to acknowledge receipt
    return NextResponse.json({ "[accepted]": true })

  } catch (error) {
    console.error("Webhook processing error:", error)
    // Return 200 to prevent Adyen from retrying - log the error for investigation
    return NextResponse.json({ "[accepted]": true })
  }
}

/**
 * Handle new token creation
 */
async function handleTokenCreated(tokenData: {
  shopperReference: string
  storedPaymentMethodId?: string
  paymentMethod?: {
    type?: string
    brand?: string
    lastFour?: string
    expiryMonth?: string
    expiryYear?: string
    holderName?: string
  }
}) {
  const orgId = await resolveOrgIdFromShopperRef(tokenData.shopperReference)
  
  if (!orgId) {
    console.log("Could not extract org ID from shopper reference:", tokenData.shopperReference)
    return
  }

  // Check if organization exists
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  })

  if (!organization) {
    console.log("Organization not found:", orgId)
    return
  }

  // Check if this payment method already exists
  const existingMethod = await db.organizationPaymentMethod.findUnique({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
  })

  if (existingMethod) {
    console.log("Payment method already exists:", tokenData.storedPaymentMethodId)
    return
  }

  // Check if this is the first payment method for this org
  const existingMethods = await db.organizationPaymentMethod.count({
    where: { organizationId: orgId, isActive: true },
  })
  const isDefault = existingMethods === 0

  // Create the payment method record
  await db.organizationPaymentMethod.create({
    data: {
      organizationId: orgId,
      storedPaymentMethodId: tokenData.storedPaymentMethodId!,
      shopperReference: tokenData.shopperReference,
      type: tokenData.paymentMethod?.type || "scheme",
      brand: tokenData.paymentMethod?.brand,
      lastFour: tokenData.paymentMethod?.lastFour || "****",
      expiryMonth: tokenData.paymentMethod?.expiryMonth,
      expiryYear: tokenData.paymentMethod?.expiryYear,
      holderName: tokenData.paymentMethod?.holderName,
      isDefault,
      isActive: true,
    },
  })

  // If this is the default, update the subscription with the recurring detail ref
  if (isDefault) {
    await db.organizationSubscription.updateMany({
      where: { organizationId: orgId },
      data: {
        adyenRecurringDetailRef: tokenData.storedPaymentMethodId,
      },
    })
  }

  console.log("Created payment method for org:", orgId)
}

/**
 * Handle token update (e.g., card details updated by issuer)
 */
async function handleTokenUpdated(tokenData: {
  storedPaymentMethodId?: string
  paymentMethod?: {
    type?: string
    brand?: string
    lastFour?: string
    expiryMonth?: string
    expiryYear?: string
    holderName?: string
  }
}) {
  if (!tokenData.storedPaymentMethodId) return

  // Find the existing payment method
  const existingMethod = await db.organizationPaymentMethod.findUnique({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
  })

  if (!existingMethod) {
    console.log("Payment method not found for update:", tokenData.storedPaymentMethodId)
    return
  }

  // Update the payment method with new details
  await db.organizationPaymentMethod.update({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
    data: {
      brand: tokenData.paymentMethod?.brand || existingMethod.brand,
      lastFour: tokenData.paymentMethod?.lastFour || existingMethod.lastFour,
      expiryMonth: tokenData.paymentMethod?.expiryMonth || existingMethod.expiryMonth,
      expiryYear: tokenData.paymentMethod?.expiryYear || existingMethod.expiryYear,
      holderName: tokenData.paymentMethod?.holderName || existingMethod.holderName,
    },
  })

  console.log("Updated payment method:", tokenData.storedPaymentMethodId)
}

/**
 * Handle token disabled/deleted
 */
async function handleTokenDisabled(tokenData: {
  storedPaymentMethodId?: string
}) {
  if (!tokenData.storedPaymentMethodId) return

  // Find the existing payment method
  const existingMethod = await db.organizationPaymentMethod.findUnique({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
  })

  if (!existingMethod) {
    console.log("Payment method not found for disable:", tokenData.storedPaymentMethodId)
    return
  }

  // Mark as inactive instead of deleting (for audit trail)
  await db.organizationPaymentMethod.update({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
    data: {
      isActive: false,
      isDefault: false,
    },
  })

  // If this was the default, try to set another as default
  if (existingMethod.isDefault) {
    const nextMethod = await db.organizationPaymentMethod.findFirst({
      where: {
        organizationId: existingMethod.organizationId,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    })

    if (nextMethod) {
      await db.organizationPaymentMethod.update({
        where: { id: nextMethod.id },
        data: { isDefault: true },
      })

      // Update subscription with new default
      await db.organizationSubscription.updateMany({
        where: { organizationId: existingMethod.organizationId },
        data: {
          adyenRecurringDetailRef: nextMethod.storedPaymentMethodId,
        },
      })
    } else {
      // No more payment methods - clear the subscription reference
      await db.organizationSubscription.updateMany({
        where: { organizationId: existingMethod.organizationId },
        data: {
          adyenRecurringDetailRef: null,
        },
      })
    }
  }

  console.log("Disabled payment method:", tokenData.storedPaymentMethodId)
}

/**
 * Extract organization ID from Adyen shopper reference.
 * 
 * Formats:
 * - "org-{orgId}" - permanent reference for existing orgs
 * - "signup-{subdomain}-{timestamp}" - temporary reference during signup
 *
 * For signup references, looks up the org by subdomain. If the org hasn't
 * been created yet (race condition), returns null -- the org signup API
 * will claim orphaned tokens after org creation.
 */
async function resolveOrgIdFromShopperRef(shopperReference: string): Promise<string | null> {
  if (!shopperReference) return null

  if (shopperReference.startsWith("org-")) {
    return shopperReference.replace("org-", "")
  }

  if (shopperReference.startsWith("signup-")) {
    // Format: signup-{subdomain}-{timestamp}
    // Extract subdomain by removing prefix and the trailing timestamp segment
    const withoutPrefix = shopperReference.replace("signup-", "")
    const lastDash = withoutPrefix.lastIndexOf("-")
    const subdomain = lastDash > 0 ? withoutPrefix.substring(0, lastDash) : withoutPrefix

    if (subdomain) {
      const config = await db.websiteConfig.findUnique({
        where: { subdomain },
        select: { organizationId: true },
      })
      if (config) {
        return config.organizationId
      }
    }

    console.log("Signup reference - org not found yet, token will be claimed after org creation:", shopperReference)
    return null
  }

  return null
}
