import type { BulkDiscountType, DiscountType } from "@prisma/client";
import { z } from "zod";

export const bulkDiscountItemSchema = z.object({
  type: z.enum(["FAMILY_SIBLING", "MULTI_SESSION"]),
  minQuantity: z.number().int().min(1),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().min(0.01),
});

export const bulkDiscountsSchema = z
  .array(bulkDiscountItemSchema)
  .max(5, "A program can have at most 5 discounts")
  .optional();

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

export function validateBulkDiscount(
  discount: {
    type: "MULTI_SESSION" | "FAMILY_SIBLING";
    minQuantity: number;
    discountType: "FIXED_AMOUNT" | "PERCENTAGE";
    discountValue: number;
  },
  effectivePrice: number
): string | null {
  if (isNaN(effectivePrice) || effectivePrice < 0) return "Invalid program price";
  if (!discount.minQuantity || discount.minQuantity < 1)
    return "Minimum quantity must be at least 1";
  const value = Number(discount.discountValue);
  if (isNaN(value) || value <= 0) return "Discount amount must be greater than 0";
  if (discount.discountType === "PERCENTAGE") {
    if (value < 1 || value > 100) return "Percentage discount must be between 1% and 100%";
    return null;
  }
  if (value > discount.minQuantity * effectivePrice) {
    return `Discount cannot exceed the total cost ($${(discount.minQuantity * effectivePrice).toFixed(2)})`;
  }
  return null;
}

export type ProgramPricingInfo = {
  billingInterval: string;
  basePrice?: number | null;
  perSessionPrice?: number | null;
  recurringPrice?: number | null;
};

export function resolveEffectivePrice(pricingInfo: ProgramPricingInfo): number {
  if (pricingInfo.billingInterval !== "ONE_TIME" && pricingInfo.billingInterval !== "SESSION") {
    return Number(pricingInfo.recurringPrice ?? 0);
  }
  return Number(pricingInfo.basePrice ?? pricingInfo.perSessionPrice ?? 0);
}

export function validateBulkDiscountsForProgram(
  discounts: z.infer<typeof bulkDiscountItemSchema>[],
  pricingInfo: ProgramPricingInfo
): string | null {
  if (!discounts.length) return null;
  const effectivePrice = resolveEffectivePrice(pricingInfo);
  if (!effectivePrice || effectivePrice <= 0) {
    return "Discounts cannot be added to a free program";
  }
  const seen = new Set<string>();
  for (const d of discounts) {
    const key = `${d.type}:${d.minQuantity}`;
    if (seen.has(key)) {
      return `Duplicate discount: ${d.type === "MULTI_SESSION" ? "session" : "family"} discount for quantity ${d.minQuantity} appears more than once`;
    }
    seen.add(key);
    const err = validateBulkDiscount(d, effectivePrice);
    if (err) return err;
  }
  return null;
}

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
  const value = Number(discount.discountValue);
  if (isNaN(value) || value <= 0) return 0;
  if (discount.discountType === "PERCENTAGE") {
    return Math.round(subtotal * (value / 100) * 100) / 100;
  }
  return Math.round(Math.min(subtotal, value) * 100) / 100;
}

/**
 * Calculates the total bulk discount across a list of cart items.
 *
 * PER_INSTANCE programs (items with instanceId):
 *   - MULTI_SESSION and FAMILY_SIBLING are both evaluated per athlete.
 *   - Only the better (higher savings) discount applies — never stacked.
 *   - FAMILY_SIBLING applies to all athletes when athleteCount >= minQuantity.
 *
 * ALL_INSTANCES programs (items without instanceId):
 *   - Only FAMILY_SIBLING applies.
 *   - When athleteCount >= minQuantity, ALL enrolled athletes receive the discount.
 *
 * @param items - All cart items
 * @param bulkDiscountsByProgramId - Map of programId → bulk discounts
 * @param getPriceForIndex - Optional price resolver; defaults to item.price * item.quantity
 */
export function calculateBulkDiscounts(
  items: BulkDiscountCartItem[],
  bulkDiscountsByProgramId: Map<string, BulkDiscount[]>,
  getPriceForIndex?: (index: number, item: BulkDiscountCartItem) => number
): {
  totalDiscount: number;
  breakdown: Array<{ label: string; amount: number; discountId: string }>;
} {
  const getPrice = getPriceForIndex ?? ((_, item) => item.price * item.quantity);

  const programItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === "program");

  const breakdown: Array<{ label: string; amount: number; discountId: string }> = [];
  let totalDiscount = 0;

  // ── PER_INSTANCE (items with instanceId) ─────────────────────────────────

  // Group sessions by (programId:athleteId); track sibling order per program
  const perInstanceGroups = new Map<
    string,
    { indices: number[]; programId: string; athleteId: string }
  >();
  const perInstanceSiblingOrder = new Map<string, string[]>();

  for (const { item, index } of programItems) {
    if (!item.details?.instanceId) continue;
    const programId = item.details.programId as string | undefined;
    if (!programId) continue;
    const athleteId = item.athleteId ?? "";
    const key = `${programId}:${athleteId}`;
    if (!perInstanceGroups.has(key)) {
      perInstanceGroups.set(key, { indices: [], programId, athleteId });
      if (!perInstanceSiblingOrder.has(programId)) perInstanceSiblingOrder.set(programId, []);
      perInstanceSiblingOrder.get(programId)!.push(athleteId);
    }
    perInstanceGroups.get(key)!.indices.push(index);
  }

  // MULTI_SESSION savings per athlete
  const multiSavingsMap = new Map<string, { amount: number; label: string; discountId: string }>();
  for (const [key, group] of perInstanceGroups) {
    const discounts = bulkDiscountsByProgramId.get(group.programId) ?? [];
    const discount = getBestDiscount(discounts, "MULTI_SESSION", group.indices.length);
    if (!discount) continue;
    const groupSubtotal = group.indices.reduce((sum, idx) => sum + getPrice(idx, items[idx]), 0);
    const amount = getDiscountAmount(groupSubtotal, discount);
    if (amount > 0) {
      multiSavingsMap.set(key, {
        amount,
        label: `Multi-session discount (${group.indices.length} sessions)`,
        discountId: discount.id,
      });
    }
  }

  // FAMILY_SIBLING savings per athlete — apply to all athletes when athleteCount >= minQuantity
  const familySavingsMap = new Map<string, { amount: number; discountId: string }>();
  for (const [programId, athleteIds] of perInstanceSiblingOrder) {
    const discounts = bulkDiscountsByProgramId.get(programId) ?? [];
    const siblingDiscounts = discounts.filter((d) => d.type === "FAMILY_SIBLING");
    if (siblingDiscounts.length === 0) continue;
    const athleteCount = athleteIds.length;
    const discount = getBestDiscount(siblingDiscounts, "FAMILY_SIBLING", athleteCount);
    if (!discount) continue;
    for (const athleteId of athleteIds) {
      const key = `${programId}:${athleteId}`;
      const group = perInstanceGroups.get(key);
      if (group) {
        const athleteSubtotal = group.indices.reduce(
          (sum, idx) => sum + getPrice(idx, items[idx]),
          0
        );
        const amount = getDiscountAmount(athleteSubtotal, discount);
        if (amount > 0) familySavingsMap.set(key, { amount, discountId: discount.id });
      }
    }
  }

  // Apply best-of per athlete
  const allPerInstanceKeys = new Set([...multiSavingsMap.keys(), ...familySavingsMap.keys()]);
  for (const key of allPerInstanceKeys) {
    const multiEntry = multiSavingsMap.get(key);
    const familyEntry = familySavingsMap.get(key);
    const multiAmt = multiEntry?.amount ?? 0;
    const familyAmt = familyEntry?.amount ?? 0;
    const bestAmt = Math.max(multiAmt, familyAmt);
    if (bestAmt > 0) {
      const useMulti = multiAmt >= familyAmt;
      totalDiscount += bestAmt;
      breakdown.push({
        label: useMulti ? (multiEntry?.label ?? "Multi-session discount") : "Sibling discount",
        amount: bestAmt,
        discountId: useMulti ? multiEntry!.discountId : familyEntry!.discountId,
      });
    }
  }

  // ── ALL_INSTANCES (items without instanceId) ──────────────────────────────

  const allInstancesGroups = new Map<
    string,
    { programId: string; athleteIndices: Map<string, number[]> }
  >();
  for (const { item, index } of programItems) {
    if (item.details?.instanceId) continue;
    const programId = item.details?.programId as string | undefined;
    if (!programId) continue;
    if (!allInstancesGroups.has(programId)) {
      allInstancesGroups.set(programId, { programId, athleteIndices: new Map() });
    }
    const g = allInstancesGroups.get(programId)!;
    const athleteId = item.athleteId ?? "";
    if (!g.athleteIndices.has(athleteId)) g.athleteIndices.set(athleteId, []);
    g.athleteIndices.get(athleteId)!.push(index);
  }

  for (const [programId, group] of allInstancesGroups) {
    const discounts = bulkDiscountsByProgramId.get(programId) ?? [];
    const familyDiscounts = discounts.filter((d) => d.type === "FAMILY_SIBLING");
    if (familyDiscounts.length === 0) continue;
    const athleteCount = group.athleteIndices.size;
    const discount = getBestDiscount(familyDiscounts, "FAMILY_SIBLING", athleteCount);
    if (!discount) continue;
    for (const [, indices] of group.athleteIndices) {
      const athleteSubtotal = indices.reduce((sum, idx) => sum + getPrice(idx, items[idx]), 0);
      const amount = getDiscountAmount(athleteSubtotal, discount);
      if (amount > 0) {
        totalDiscount += amount;
        breakdown.push({ label: "Family discount", amount, discountId: discount.id });
      }
    }
  }

  return { totalDiscount: Math.round(totalDiscount * 100) / 100, breakdown };
}
