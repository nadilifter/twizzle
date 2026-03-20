import { db } from "@/lib/db"
import { isAdyenConfigured, getStoredPaymentMethods } from "@/lib/adyen"

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
  if (!isAdyenConfigured()) return

  const subscription = await db.organizationSubscription.findUnique({
    where: { organizationId },
    select: { adyenShopperReference: true },
  })

  const shopperReference = subscription?.adyenShopperReference || `org-${organizationId}`

  const [adyenMethods, localMethods] = await Promise.all([
    getStoredPaymentMethods(shopperReference),
    db.organizationPaymentMethod.findMany({
      where: { organizationId, isActive: true },
    }),
  ])

  const localByAdyenId = new Map(
    localMethods.map((m) => [m.storedPaymentMethodId, m])
  )
  const adyenIds = new Set(adyenMethods.map((m) => m.id))

  for (const adyenMethod of adyenMethods) {
    const local = localByAdyenId.get(adyenMethod.id)

    if (!local) {
      const isFirst = localMethods.length === 0 && adyenMethods.indexOf(adyenMethod) === 0
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
      })
    } else {
      const needsUpdate =
        adyenMethod.brand !== (local.brand ?? undefined) ||
        adyenMethod.lastFour !== local.lastFour ||
        adyenMethod.expiryMonth !== (local.expiryMonth ?? undefined) ||
        adyenMethod.expiryYear !== (local.expiryYear ?? undefined) ||
        adyenMethod.holderName !== (local.holderName ?? undefined)

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
        })
      }
    }
  }

  for (const local of localMethods) {
    if (!adyenIds.has(local.storedPaymentMethodId)) {
      await db.organizationPaymentMethod.update({
        where: { id: local.id },
        data: { isActive: false, isDefault: false },
      })
    }
  }
}
