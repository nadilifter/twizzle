"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureToggles } from "@/lib/feature-toggles";
import { organizationFeaturesQueryKey } from "./use-organization-features";

export interface SuperadminFeatureData {
  plan: { id: string; name: string } | null;
  planDefaults: FeatureToggles | null;
  overrides: Record<string, boolean> | null;
  resolved: FeatureToggles;
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
}

export const superadminOrganizationFeaturesQueryKey = (organizationId: string | null | undefined) =>
  ["superadmin-organization-features", organizationId ?? null] as const;

async function fetchSuperadminFeatures(organizationId: string): Promise<SuperadminFeatureData> {
  const response = await fetch(`/api/superadmin/organizations/${organizationId}/features`);
  if (!response.ok) {
    throw new Error(`Failed to fetch superadmin features: ${response.statusText}`);
  }
  return response.json();
}

export function useSuperadminOrganizationFeatures(
  organizationId: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: superadminOrganizationFeaturesQueryKey(organizationId),
    queryFn: () => fetchSuperadminFeatures(organizationId as string),
    enabled: !!organizationId && enabled,
  });
}

async function updateSuperadminFeatures(
  organizationId: string,
  featureToggles: Record<string, boolean>
): Promise<{ resolved: FeatureToggles }> {
  const response = await fetch(`/api/superadmin/organizations/${organizationId}/features`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featureToggles }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save feature overrides");
  }
  return response.json();
}

export function useUpdateSuperadminFeatureOverrides(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (featureToggles: Record<string, boolean>) => {
      if (!organizationId) {
        return Promise.reject(new Error("organizationId is required"));
      }
      return updateSuperadminFeatures(organizationId, featureToggles);
    },
    onSuccess: ({ resolved }, featureToggles) => {
      if (!organizationId) return;

      queryClient.setQueryData<SuperadminFeatureData | undefined>(
        superadminOrganizationFeaturesQueryKey(organizationId),
        (prev) => (prev ? { ...prev, overrides: featureToggles, resolved } : prev)
      );
      queryClient.setQueryData<FeatureToggles>(
        organizationFeaturesQueryKey(organizationId),
        resolved
      );
      queryClient.invalidateQueries({
        queryKey: organizationFeaturesQueryKey(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: superadminOrganizationFeaturesQueryKey(organizationId),
      });
    },
  });
}
