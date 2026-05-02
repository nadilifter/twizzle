"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, Shield, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDebounce } from "@/hooks";
import { useOrganizationFeatures } from "@/hooks/use-organization-features";
import {
  superadminOrganizationFeaturesQueryKey,
  useSuperadminOrganizationFeatures,
  useUpdateSuperadminFeatureOverrides,
} from "@/hooks/use-superadmin-organization-features";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  type FeatureKey,
} from "@/lib/feature-toggles";

export default function OrganizationFeaturesPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
  const organizationId = session?.user?.organizationId;

  const queryClient = useQueryClient();
  const superadminQuery = useSuperadminOrganizationFeatures(organizationId, isSuperAdmin);
  const orgFeaturesQuery = useOrganizationFeatures();
  const updateOverrides = useUpdateSuperadminFeatureOverrides(organizationId);

  const superadminData = superadminQuery.data ?? null;

  const [overrideToggles, setOverrideToggles] = useState<Record<string, boolean>>({});

  // Sync local edit state when the server-side overrides change (initial load, external refetch).
  useEffect(() => {
    if (!isSuperAdmin) return;
    const serverOverrides = superadminData?.overrides;
    setOverrideToggles(
      serverOverrides && typeof serverOverrides === "object" && !Array.isArray(serverOverrides)
        ? { ...serverOverrides }
        : {}
    );
  }, [isSuperAdmin, superadminData?.overrides]);

  const features = isSuperAdmin
    ? (superadminData?.resolved ?? null)
    : orgFeaturesQuery.isLoaded
      ? orgFeaturesQuery.features
      : null;

  const isLoading = isSuperAdmin ? superadminQuery.isLoading : !orgFeaturesQuery.isLoaded;
  const isSaving = updateOverrides.isPending;

  const hasChanges = useMemo(() => {
    const savedOverrides = superadminData?.overrides ?? {};
    const keys = new Set([...Object.keys(overrideToggles), ...Object.keys(savedOverrides)]);
    return [...keys].some(
      (k) => overrideToggles[k] !== (savedOverrides as Record<string, boolean>)[k]
    );
  }, [overrideToggles, superadminData?.overrides]);

  const { mutate: mutateOverrides } = updateOverrides;
  const autoSave = useCallback(
    (toggles: Record<string, boolean>) => {
      mutateOverrides(toggles, {
        onSuccess: () => {
          toast.success("Changes Saved");
          queryClient.invalidateQueries({
            queryKey: superadminOrganizationFeaturesQueryKey(organizationId),
          });
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save"),
      });
    },
    [mutateOverrides, queryClient, organizationId]
  );

  useDebounce(overrideToggles, 1000, isSuperAdmin && hasChanges ? autoSave : null);

  const handleToggleOverride = (key: FeatureKey, enabled: boolean) => {
    if (!superadminData) return;
    const planDefault = superadminData.planDefaults?.[key] ?? false;

    setOverrideToggles((prev) => {
      const next = { ...prev };
      if (enabled === planDefault) {
        delete next[key];
      } else {
        next[key] = enabled;
      }
      return next;
    });
  };

  const handleResetOverrides = () => {
    if (!superadminData) return;
    setOverrideToggles({});
    autoSave({});
  };

  const getResolvedValue = (key: FeatureKey): boolean => {
    if (!superadminData) return features?.[key] ?? false;
    const planDefault = superadminData.planDefaults?.[key] ?? false;
    if (key in overrideToggles) return overrideToggles[key];
    return planDefault;
  };

  const enabledCount = features ? FEATURE_KEYS.filter((k) => getResolvedValue(k)).length : 0;

  const sortedFeatureKeys = useMemo(() => {
    const planDefaults = superadminData?.planDefaults;
    return [...FEATURE_KEYS].sort((a, b) => {
      const aEnabled = planDefaults ? planDefaults[a] : (features?.[a] ?? false);
      const bEnabled = planDefaults ? planDefaults[b] : (features?.[b] ?? false);
      if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
      return FEATURE_LABELS[a].localeCompare(FEATURE_LABELS[b]);
    });
  }, [superadminData?.planDefaults, features]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        variant="small"
        title="Features"
        description={
          isSuperAdmin
            ? "Manage feature access for this organization. Toggle overrides beyond the plan defaults."
            : "View which features are available on your current plan"
        }
        actions={
          isSuperAdmin && superadminData?.plan ? (
            <Badge variant="outline" className="text-xs">
              Plan: {superadminData.plan.name}
            </Badge>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !features ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Unable to load feature information. Please try again later.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {enabledCount} of {FEATURE_KEYS.length} features enabled
              </span>
            </div>
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetOverrides}
                disabled={isSaving}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <TooltipProvider>
            <div className="grid gap-4 md:grid-cols-2">
              {sortedFeatureKeys.map((key) => {
                const resolvedEnabled = isSuperAdmin ? getResolvedValue(key) : features[key];
                const planDefault = superadminData?.planDefaults?.[key] ?? false;
                const isOverridden = isSuperAdmin && key in overrideToggles;

                return (
                  <Card key={key} className={!resolvedEnabled ? "opacity-60" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {resolvedEnabled ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                          {FEATURE_LABELS[key]}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {isSuperAdmin && isOverridden && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Info className="h-3 w-3" />
                                  Override
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This feature has a superadmin override.</p>
                                <p className="text-xs text-muted-foreground">
                                  Plan default: {planDefault ? "Enabled" : "Disabled"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {isSuperAdmin ? (
                            <Switch
                              checked={resolvedEnabled}
                              onCheckedChange={(checked) => handleToggleOverride(key, checked)}
                              disabled={isSaving}
                            />
                          ) : (
                            <Badge variant={resolvedEnabled ? "default" : "secondary"}>
                              {resolvedEnabled ? "Enabled" : "Not included"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{FEATURE_DESCRIPTIONS[key]}</p>
                      {isSuperAdmin && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Plan default: {planDefault ? "Enabled" : "Disabled"}
                          {isOverridden ? " (overridden)" : ""}
                        </p>
                      )}
                      {!isSuperAdmin && !resolvedEnabled && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Contact your administrator to upgrade your plan for access to this
                          feature.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}
