/**
 * Feature Resolver
 *
 * Server-side logic for resolving an organization's effective feature toggles.
 * Combines plan-level defaults with superadmin per-org overrides.
 */

import { db } from "./db";
import {
  DEFAULT_FEATURE_TOGGLES,
  parseFeatureToggles,
  mergeFeatureToggles,
  type FeatureKey,
  type FeatureToggles,
} from "./feature-toggles";

/**
 * Resolves the effective feature toggles for an organization.
 *
 * Resolution order:
 * 1. Start with plan's featureToggles (or all-disabled defaults if no plan)
 * 2. Overlay any OrganizationFeatureOverride values (superadmin per-org overrides)
 */
export async function getOrganizationFeatures(
  organizationId: string
): Promise<FeatureToggles> {
  if (!organizationId) {
    return { ...DEFAULT_FEATURE_TOGGLES };
  }

  // Fetch the org's subscription (with plan) and any feature overrides in one query
  const [subscription, override] = await Promise.all([
    db.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        plan: {
          select: { featureToggles: true },
        },
      },
    }),
    db.organizationFeatureOverride.findUnique({
      where: { organizationId },
      select: { featureToggles: true },
    }),
  ]);

  // Parse plan-level toggles (defaults to all-disabled if no plan)
  const planToggles = subscription?.plan?.featureToggles
    ? parseFeatureToggles(subscription.plan.featureToggles)
    : { ...DEFAULT_FEATURE_TOGGLES };

  // Parse override toggles (partial, only overridden keys)
  const overrideToggles = override?.featureToggles
    ? (parsePartialToggles(override.featureToggles) as Partial<FeatureToggles>)
    : null;

  return mergeFeatureToggles(planToggles, overrideToggles);
}

/**
 * Check if a specific feature is enabled for an organization.
 */
export async function isFeatureEnabled(
  organizationId: string,
  feature: FeatureKey
): Promise<boolean> {
  const features = await getOrganizationFeatures(organizationId);
  return features[feature];
}

/**
 * Guard helper for API routes. Throws a structured error if the feature is disabled.
 * Returns the feature toggles if the check passes.
 */
export async function requireFeature(
  organizationId: string,
  feature: FeatureKey
): Promise<FeatureToggles> {
  const features = await getOrganizationFeatures(organizationId);
  if (!features[feature]) {
    const error = new FeatureDisabledError(feature);
    throw error;
  }
  return features;
}

/**
 * Custom error for disabled features, used by API routes to return 403.
 */
export class FeatureDisabledError extends Error {
  public readonly feature: FeatureKey;
  public readonly statusCode = 403;

  constructor(feature: FeatureKey) {
    super(`Feature "${feature}" is not available on your current plan`);
    this.name = "FeatureDisabledError";
    this.feature = feature;
  }
}

/**
 * API route guard. Returns a 403 NextResponse if the feature is disabled,
 * or null if the feature is enabled and the request can proceed.
 *
 * Usage in API routes:
 *   const blocked = await checkFeatureGate(orgId, "events");
 *   if (blocked) return blocked;
 */
export async function checkFeatureGate(
  organizationId: string,
  feature: FeatureKey
): Promise<Response | null> {
  const enabled = await isFeatureEnabled(organizationId, feature);
  if (!enabled) {
    const { NextResponse } = await import("next/server");
    return NextResponse.json(
      { error: `Feature "${feature}" is not available on your current plan` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Parse partial feature toggles from an override record.
 * Only returns keys that are explicitly set (not all keys).
 */
function parsePartialToggles(
  raw: unknown
): Partial<FeatureToggles> {
  const result: Partial<FeatureToggles> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "boolean") {
        result[key as FeatureKey] = val;
      }
    }
  }
  return result;
}
