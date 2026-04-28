"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  DEFAULT_FEATURE_TOGGLES,
  type FeatureKey,
  type FeatureToggles,
} from "@/lib/feature-toggles";

export const organizationFeaturesQueryKey = (organizationId: string | null | undefined) =>
  ["organization-features", organizationId ?? null] as const;

async function fetchOrganizationFeatures(): Promise<FeatureToggles> {
  const response = await fetch("/api/organization/features");
  if (!response.ok) {
    throw new Error(`Failed to fetch features: ${response.statusText}`);
  }
  return response.json();
}

export interface UseOrganizationFeaturesResult {
  features: FeatureToggles;
  isLoaded: boolean;
  isFeatureEnabled: (key: FeatureKey) => boolean;
}

export function useOrganizationFeatures(): UseOrganizationFeaturesResult {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? null;

  const query = useQuery({
    queryKey: organizationFeaturesQueryKey(organizationId),
    queryFn: fetchOrganizationFeatures,
    enabled: !!organizationId,
    // Feature toggles can flip at any time via superadmin; always revalidate
    // on mount/focus so the sidebar doesn't show stale state after an update.
    staleTime: 0,
  });

  const features = query.data ?? DEFAULT_FEATURE_TOGGLES;

  return {
    features,
    isLoaded: query.isSuccess,
    isFeatureEnabled: (key: FeatureKey) => features[key] ?? false,
  };
}
