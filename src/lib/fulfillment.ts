import { db } from "@/lib/db";

export type FulfillmentType = "PICKUP_ONLY" | "DELIVERY_ONLY" | "PICKUP_OR_DELIVERY";

type ResolveResult = { ok: true; facilityId: string | null } | { ok: false; error: string };

/**
 * Resolves the pickupFacilityId for a product given its fulfillment policy and an
 * optional client-supplied facility id. Enforces org ownership and ACTIVE status
 * when a facility is supplied. Falls back to the org's default facility (isDefault
 * first, else first ACTIVE by name) when none is supplied for pickup-capable
 * products. Errors when a pickup-capable product has no resolvable facility so
 * we never persist an order with nowhere to pick it up.
 */
export async function resolveProductPickupFacility(
  organizationId: string,
  fulfillmentType: FulfillmentType,
  pickupFacilityId: string | null | undefined
): Promise<ResolveResult> {
  if (fulfillmentType === "DELIVERY_ONLY") {
    return { ok: true, facilityId: null };
  }

  if (pickupFacilityId) {
    const facility = await db.facility.findFirst({
      where: { id: pickupFacilityId, organizationId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!facility) {
      return { ok: false, error: "Pickup facility not found for this organization" };
    }
    return { ok: true, facilityId: facility.id };
  }

  const defaultFacility = await db.facility.findFirst({
    where: { organizationId, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!defaultFacility) {
    return {
      ok: false,
      error:
        "An active facility is required for pickup products. Add one in Organization → Facilities.",
    };
  }
  return { ok: true, facilityId: defaultFacility.id };
}
