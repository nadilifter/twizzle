import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, parseRecurringTokenWebhook } from "@/lib/adyen";
import { logger } from "@/lib/logger";

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
    const body = await request.text();

    if (!process.env.ADYEN_WEBHOOK_HMAC_KEY) {
      console.error("ADYEN_WEBHOOK_HMAC_KEY is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const hmacSignature = request.headers.get("hmac-signature") || "";
    if (!hmacSignature) {
      console.error("Missing webhook HMAC signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const isValid = verifyWebhookSignature(body, hmacSignature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse the webhook notification
    const tokenData = parseRecurringTokenWebhook(body);

    if (!tokenData) {
      console.error("Failed to parse webhook notification");
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    logger.info("Adyen recurring webhook received", {
      eventCode: tokenData.eventCode,
      shopperReference: tokenData.shopperReference,
      storedPaymentMethodId: tokenData.storedPaymentMethodId,
      success: tokenData.success,
    });

    const isUserToken = tokenData.shopperReference.startsWith("user-");

    // Handle different event types
    switch (tokenData.eventCode) {
      case "RECURRING_CONTRACT":
      case "AUTHORISATION":
        if (tokenData.success && tokenData.storedPaymentMethodId) {
          if (isUserToken) {
            await handleUserTokenCreated(tokenData);
          } else {
            await handleTokenCreated(tokenData);
          }
        }
        break;

      case "RECURRING_CONTRACT_UPDATED":
        if (tokenData.success && tokenData.storedPaymentMethodId) {
          if (isUserToken) {
            await handleUserTokenUpdated(tokenData);
          } else {
            await handleTokenUpdated(tokenData);
          }
        }
        break;

      case "RECURRING_CONTRACT_DISABLED":
        if (tokenData.storedPaymentMethodId) {
          if (isUserToken) {
            await handleUserTokenDisabled(tokenData);
          } else {
            await handleTokenDisabled(tokenData);
          }
        }
        break;

      default:
        logger.debug("Unhandled recurring webhook event type", { eventCode: tokenData.eventCode });
    }

    return NextResponse.json({ notificationResponse: "[accepted]" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ notificationResponse: "[accepted]" });
  }
}

/**
 * Handle new token creation
 */
async function handleTokenCreated(tokenData: {
  shopperReference: string;
  storedPaymentMethodId?: string;
  paymentMethod?: {
    type?: string;
    brand?: string;
    lastFour?: string;
    expiryMonth?: string;
    expiryYear?: string;
    holderName?: string;
  };
}) {
  const orgId = await resolveOrgIdFromShopperRef(tokenData.shopperReference);

  if (!orgId) {
    logger.info("Could not extract org ID from shopper reference", {
      shopperReference: tokenData.shopperReference,
    });
    return;
  }

  // Check if organization exists
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });

  if (!organization) {
    logger.info("Organization not found", { orgId });
    return;
  }

  // Check if this payment method already exists
  const existingMethod = await db.organizationPaymentMethod.findUnique({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
  });

  if (existingMethod) {
    logger.debug("Payment method already exists", {
      storedPaymentMethodId: tokenData.storedPaymentMethodId,
    });
    return;
  }

  // Check if this is the first payment method for this org
  const existingMethods = await db.organizationPaymentMethod.count({
    where: { organizationId: orgId, isActive: true },
  });
  const isDefault = existingMethods === 0;

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
  });

  // If this is the default, update the subscription with the recurring detail ref
  if (isDefault) {
    await db.organizationSubscription.updateMany({
      where: { organizationId: orgId },
      data: {
        adyenRecurringDetailRef: tokenData.storedPaymentMethodId,
      },
    });
  }

  logger.info("Created payment method for org", { orgId });

  // Auto-retry outstanding subscription invoice if the org is in a grace period
  try {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { scheduledDeactivationDate: true },
    });

    if (org?.scheduledDeactivationDate) {
      const { retryOutstandingInvoice } = await import("@/lib/subscription-billing");
      const success = await retryOutstandingInvoice(orgId);
      logger.info("Auto-retry billing after new payment method", { orgId, success });
    }
  } catch (err) {
    logger.error("Failed to auto-retry billing after new payment method", {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Handle token update (e.g., card details updated by issuer)
 */
async function handleTokenUpdated(tokenData: {
  storedPaymentMethodId?: string;
  paymentMethod?: {
    type?: string;
    brand?: string;
    lastFour?: string;
    expiryMonth?: string;
    expiryYear?: string;
    holderName?: string;
  };
}) {
  if (!tokenData.storedPaymentMethodId) return;

  // Find the existing payment method
  const existingMethod = await db.organizationPaymentMethod.findUnique({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
  });

  if (!existingMethod) {
    logger.info("Payment method not found for update", {
      storedPaymentMethodId: tokenData.storedPaymentMethodId,
    });
    return;
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
  });

  logger.info("Updated payment method", { storedPaymentMethodId: tokenData.storedPaymentMethodId });
}

/**
 * Handle token disabled/deleted
 */
async function handleTokenDisabled(tokenData: { storedPaymentMethodId?: string }) {
  if (!tokenData.storedPaymentMethodId) return;

  // Find the existing payment method
  const existingMethod = await db.organizationPaymentMethod.findUnique({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
  });

  if (!existingMethod) {
    logger.info("Payment method not found for disable", {
      storedPaymentMethodId: tokenData.storedPaymentMethodId,
    });
    return;
  }

  // Mark as inactive instead of deleting (for audit trail)
  await db.organizationPaymentMethod.update({
    where: { storedPaymentMethodId: tokenData.storedPaymentMethodId },
    data: {
      isActive: false,
      isDefault: false,
    },
  });

  // If this was the default, try to set another as default
  if (existingMethod.isDefault) {
    const nextMethod = await db.organizationPaymentMethod.findFirst({
      where: {
        organizationId: existingMethod.organizationId,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (nextMethod) {
      await db.organizationPaymentMethod.update({
        where: { id: nextMethod.id },
        data: { isDefault: true },
      });

      // Update subscription with new default
      await db.organizationSubscription.updateMany({
        where: { organizationId: existingMethod.organizationId },
        data: {
          adyenRecurringDetailRef: nextMethod.storedPaymentMethodId,
        },
      });
    } else {
      // No more payment methods - clear the subscription reference
      await db.organizationSubscription.updateMany({
        where: { organizationId: existingMethod.organizationId },
        data: {
          adyenRecurringDetailRef: null,
        },
      });
    }
  }

  logger.info("Disabled payment method", {
    storedPaymentMethodId: tokenData.storedPaymentMethodId,
  });
}

// ============================================
// User-level token handlers (shopperReference: user-{userId})
// Stores tokens in the PaymentMethod model for guardian/user billing
// ============================================

async function handleUserTokenCreated(tokenData: {
  shopperReference: string;
  storedPaymentMethodId?: string;
  paymentMethod?: {
    type?: string;
    brand?: string;
    lastFour?: string;
    expiryMonth?: string;
    expiryYear?: string;
    holderName?: string;
  };
}) {
  const userId = tokenData.shopperReference.replace("user-", "");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    logger.info("User not found for token creation", { userId });
    return;
  }

  const existingMethod = await db.paymentMethod.findUnique({
    where: { adyenTokenId: tokenData.storedPaymentMethodId },
  });

  if (existingMethod) {
    logger.debug("User payment method already exists", {
      adyenTokenId: tokenData.storedPaymentMethodId,
    });
    return;
  }

  const existingCount = await db.paymentMethod.count({
    where: { userId },
  });

  const expiry =
    tokenData.paymentMethod?.expiryMonth && tokenData.paymentMethod?.expiryYear
      ? `${tokenData.paymentMethod.expiryMonth}/${tokenData.paymentMethod.expiryYear.slice(-2)}`
      : null;

  await db.paymentMethod.create({
    data: {
      userId,
      type: "CARD",
      last4: tokenData.paymentMethod?.lastFour || "****",
      brand: tokenData.paymentMethod?.brand,
      expiry,
      isDefault: existingCount === 0,
      adyenTokenId: tokenData.storedPaymentMethodId!,
      shopperReference: tokenData.shopperReference,
    },
  });

  logger.info("Created payment method for user", { userId });
}

async function handleUserTokenUpdated(tokenData: {
  shopperReference: string;
  storedPaymentMethodId?: string;
  paymentMethod?: {
    type?: string;
    brand?: string;
    lastFour?: string;
    expiryMonth?: string;
    expiryYear?: string;
    holderName?: string;
  };
}) {
  if (!tokenData.storedPaymentMethodId) return;

  const existing = await db.paymentMethod.findUnique({
    where: { adyenTokenId: tokenData.storedPaymentMethodId },
  });

  if (!existing) {
    logger.info("User payment method not found for update", {
      adyenTokenId: tokenData.storedPaymentMethodId,
    });
    return;
  }

  const expiry =
    tokenData.paymentMethod?.expiryMonth && tokenData.paymentMethod?.expiryYear
      ? `${tokenData.paymentMethod.expiryMonth}/${tokenData.paymentMethod.expiryYear.slice(-2)}`
      : undefined;

  await db.paymentMethod.update({
    where: { adyenTokenId: tokenData.storedPaymentMethodId },
    data: {
      brand: tokenData.paymentMethod?.brand || existing.brand,
      last4: tokenData.paymentMethod?.lastFour || existing.last4,
      ...(expiry && { expiry }),
    },
  });

  logger.info("Updated user payment method", { adyenTokenId: tokenData.storedPaymentMethodId });
}

async function handleUserTokenDisabled(tokenData: { storedPaymentMethodId?: string }) {
  if (!tokenData.storedPaymentMethodId) return;

  const existing = await db.paymentMethod.findUnique({
    where: { adyenTokenId: tokenData.storedPaymentMethodId },
  });

  if (!existing) {
    logger.info("User payment method not found for disable", {
      adyenTokenId: tokenData.storedPaymentMethodId,
    });
    return;
  }

  await db.paymentMethod.delete({
    where: { adyenTokenId: tokenData.storedPaymentMethodId },
  });

  // If this was the default, promote the next one
  if (existing.isDefault && existing.userId) {
    const nextMethod = await db.paymentMethod.findFirst({
      where: { userId: existing.userId },
      orderBy: { createdAt: "asc" },
    });

    if (nextMethod) {
      await db.paymentMethod.update({
        where: { id: nextMethod.id },
        data: { isDefault: true },
      });
    }
  }

  logger.info("Deleted user payment method", { adyenTokenId: tokenData.storedPaymentMethodId });
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
  if (!shopperReference) return null;

  if (shopperReference.startsWith("org-")) {
    return shopperReference.replace("org-", "");
  }

  if (shopperReference.startsWith("signup-")) {
    // Format: signup-{subdomain}-{timestamp}
    // Extract subdomain by removing prefix and the trailing timestamp segment
    const withoutPrefix = shopperReference.replace("signup-", "");
    const lastDash = withoutPrefix.lastIndexOf("-");
    const subdomain = lastDash > 0 ? withoutPrefix.substring(0, lastDash) : withoutPrefix;

    if (subdomain) {
      const config = await db.websiteConfig.findUnique({
        where: { subdomain },
        select: { organizationId: true },
      });
      if (config) {
        return config.organizationId;
      }
    }

    logger.info("Signup reference: org not found yet, token will be claimed after org creation", {
      shopperReference,
    });
    return null;
  }

  return null;
}
