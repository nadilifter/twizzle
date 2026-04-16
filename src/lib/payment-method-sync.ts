import { db } from "@/lib/db";
import { isAdyenConfigured, getStoredPaymentMethods } from "@/lib/adyen";
import { logger } from "@/lib/logger";

/**
 * Persist a stored payment method token for an authenticated user.
 * Called from both the standard AUTHORISATION webhook (checkout) and the
 * recurring RECURRING_CONTRACT webhook (explicit "add card" flow).
 * Idempotent — safe to call multiple times for the same token.
 */
export async function saveUserPaymentMethodFromToken(tokenData: {
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
}): Promise<void> {
  if (!tokenData.storedPaymentMethodId) return;

  const userId = tokenData.shopperReference.replace("user-", "");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    logger.info("User not found for token creation", { userId });
    return;
  }

  const existingCount = await db.paymentMethod.count({ where: { userId } });

  const expiry =
    tokenData.paymentMethod?.expiryMonth && tokenData.paymentMethod?.expiryYear
      ? `${tokenData.paymentMethod.expiryMonth}/${tokenData.paymentMethod.expiryYear.slice(-2)}`
      : null;

  await db.paymentMethod.upsert({
    where: { adyenTokenId: tokenData.storedPaymentMethodId },
    create: {
      userId,
      type: tokenData.paymentMethod?.type === "ach" ? "BANK" : "CARD",
      last4: tokenData.paymentMethod?.lastFour || "****",
      brand: tokenData.paymentMethod?.brand,
      expiry,
      isDefault: existingCount === 0,
      adyenTokenId: tokenData.storedPaymentMethodId,
      shopperReference: tokenData.shopperReference,
    },
    update: {},
  });

  logger.info("Saved payment method for user", { userId });
}

/**
 * Reconcile local OrganizationPaymentMethod records with Adyen's
 * actual stored payment methods. Handles three cases:
 *  - New methods in Adyen not yet in local DB (missed webhook)
 *  - Updated card details in Adyen (Account Updater, issuer changes)
 *  - Methods removed in Adyen but still active locally
 *
 * Fails silently so callers always get local records even if Adyen is unreachable.
 */
export async function syncPaymentMethodsFromAdyen(organizationId: string) {
  if (!isAdyenConfigured()) return;

  const subscription = await db.organizationSubscription.findUnique({
    where: { organizationId },
    select: { adyenShopperReference: true },
  });

  const shopperReference = subscription?.adyenShopperReference || `org-${organizationId}`;

  const [adyenMethods, localMethods] = await Promise.all([
    getStoredPaymentMethods(shopperReference),
    db.organizationPaymentMethod.findMany({
      where: { organizationId, isActive: true },
    }),
  ]);

  const localByAdyenId = new Map(localMethods.map((m) => [m.storedPaymentMethodId, m]));
  const adyenIds = new Set(adyenMethods.map((m) => m.id));

  for (const adyenMethod of adyenMethods) {
    const local = localByAdyenId.get(adyenMethod.id);

    if (!local) {
      const isFirst = localMethods.length === 0 && adyenMethods.indexOf(adyenMethod) === 0;
      await db.organizationPaymentMethod.create({
        data: {
          organizationId,
          storedPaymentMethodId: adyenMethod.id,
          shopperReference,
          type: adyenMethod.type,
          brand: adyenMethod.brand,
          lastFour: adyenMethod.lastFour || "****",
          expiryMonth: adyenMethod.expiryMonth,
          expiryYear: adyenMethod.expiryYear,
          holderName: adyenMethod.holderName,
          isDefault: isFirst,
          isActive: true,
        },
      });
    } else {
      const needsUpdate =
        adyenMethod.brand !== (local.brand ?? undefined) ||
        adyenMethod.lastFour !== local.lastFour ||
        adyenMethod.expiryMonth !== (local.expiryMonth ?? undefined) ||
        adyenMethod.expiryYear !== (local.expiryYear ?? undefined) ||
        adyenMethod.holderName !== (local.holderName ?? undefined);

      if (needsUpdate) {
        await db.organizationPaymentMethod.update({
          where: { id: local.id },
          data: {
            brand: adyenMethod.brand,
            lastFour: adyenMethod.lastFour || local.lastFour,
            expiryMonth: adyenMethod.expiryMonth,
            expiryYear: adyenMethod.expiryYear,
            holderName: adyenMethod.holderName,
          },
        });
      }
    }
  }

  for (const local of localMethods) {
    if (!adyenIds.has(local.storedPaymentMethodId)) {
      await db.organizationPaymentMethod.update({
        where: { id: local.id },
        data: { isActive: false, isDefault: false },
      });
    }
  }
}
