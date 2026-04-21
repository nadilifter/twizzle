import type { BulkDiscountType, DiscountType } from "@prisma/client";

export type BulkDiscount = {
  id: string;
  type: BulkDiscountType;
  minQuantity: number;
  discountType: DiscountType;
  discountValue: number;
};

export type BulkDiscountCartItem = {
  type: string;
  athleteId?: string;
  price: number;
  quantity: number;
  details?: Record<string, any>;
};

export function getBestDiscount(
  discounts: BulkDiscount[],
  type: BulkDiscountType,
  quantity: number
): BulkDiscount | null {
  return (
    discounts
      .filter((d) => d.type === type && quantity >= d.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0] ?? null
  );
}

export function getDiscountAmount(subtotal: number, discount: BulkDiscount): number {
  if (discount.discountType === "PERCENTAGE") {
    return Math.round(subtotal * (discount.discountValue / 100) * 100) / 100;
  }
  return Math.round(Math.min(subtotal, discount.discountValue) * 100) / 100;
}

/**
 * Calculates the total bulk discount across a list of cart items.
 *
 * @param items - All cart items
 * @param bulkDiscountsByProgramId - Map of programId → bulk discounts (fetched from DB server-side,
 *   or built from item.details.bulkDiscounts client-side)
 * @param getPriceForIndex - Optional: given an item index and item, return its total price.
 *   Defaults to item.price * item.quantity. On the server, pass a function that reads serverPrices.
 */
export function calculateBulkDiscounts(
  items: BulkDiscountCartItem[],
  bulkDiscountsByProgramId: Map<string, BulkDiscount[]>,
  getPriceForIndex?: (index: number, item: BulkDiscountCartItem) => number
): { totalDiscount: number; breakdown: Array<{ label: string; amount: number }> } {
  const getPrice = getPriceForIndex ?? ((_, item) => item.price * item.quantity);

  const programItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === "program");

  const breakdown: Array<{ label: string; amount: number }> = [];
  let totalDiscount = 0;

  // MULTI_SESSION: group per-instance items by (programId, athleteId)
  const multiSessionGroups = new Map<
    string,
    { indices: number[]; programId: string; athleteId: string }
  >();
  for (const { item, index } of programItems) {
    if (item.details?.instanceId) {
      const programId = item.details.programId as string | undefined;
      if (!programId) continue;
      const athleteId = item.athleteId ?? "";
      const key = `${programId}:${athleteId}`;
      if (!multiSessionGroups.has(key)) {
        multiSessionGroups.set(key, { indices: [], programId, athleteId });
      }
      multiSessionGroups.get(key)!.indices.push(index);
    }
  }

  for (const [, group] of multiSessionGroups) {
    const discounts = bulkDiscountsByProgramId.get(group.programId) ?? [];
    const discount = getBestDiscount(discounts, "MULTI_SESSION", group.indices.length);
    if (!discount) continue;
    const groupSubtotal = group.indices.reduce((sum, idx) => sum + getPrice(idx, items[idx]), 0);
    const amount = getDiscountAmount(groupSubtotal, discount);
    if (amount > 0) {
      totalDiscount += amount;
      breakdown.push({
        label: `Multi-session discount (${group.indices.length} sessions)`,
        amount,
      });
    }
  }

  // FAMILY_SIBLING: group by programId across distinct athleteIds (order = first appearance)
  const siblingGroups = new Map<string, Map<string, number[]>>();
  for (const { item, index } of programItems) {
    const programId = item.details?.programId as string | undefined;
    if (!programId) continue;
    const athleteId = item.athleteId ?? "";
    if (!siblingGroups.has(programId)) siblingGroups.set(programId, new Map());
    const athleteMap = siblingGroups.get(programId)!;
    if (!athleteMap.has(athleteId)) athleteMap.set(athleteId, []);
    athleteMap.get(athleteId)!.push(index);
  }

  for (const [programId, athleteMap] of siblingGroups) {
    if (athleteMap.size < 2) continue;
    const discounts = bulkDiscountsByProgramId.get(programId) ?? [];
    const siblingDiscounts = discounts.filter((d) => d.type === "FAMILY_SIBLING");
    if (siblingDiscounts.length === 0) continue;

    let position = 1;
    for (const [, athleteIndices] of athleteMap) {
      if (position === 1) {
        position++;
        continue;
      }
      const discount = getBestDiscount(siblingDiscounts, "FAMILY_SIBLING", position);
      if (discount) {
        const athleteSubtotal = athleteIndices.reduce(
          (sum, idx) => sum + getPrice(idx, items[idx]),
          0
        );
        const amount = getDiscountAmount(athleteSubtotal, discount);
        if (amount > 0) {
          totalDiscount += amount;
          breakdown.push({ label: "Sibling discount", amount });
        }
      }
      position++;
    }
  }

  return { totalDiscount: Math.round(totalDiscount * 100) / 100, breakdown };
}
