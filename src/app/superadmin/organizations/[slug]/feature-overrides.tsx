"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useSuperadminOrganizationFeatures,
  useUpdateSuperadminFeatureOverrides,
} from "@/hooks/use-superadmin-organization-features";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  type FeatureKey,
} from "@/lib/feature-toggles";

interface FeatureOverridesProps {
  organizationId: string;
  organizationName: string;
}

export function FeatureOverrides({ organizationId, organizationName }: FeatureOverridesProps) {
  const featuresQuery = useSuperadminOrganizationFeatures(organizationId);
  const updateOverrides = useUpdateSuperadminFeatureOverrides(organizationId);

  const data = featuresQuery.data ?? null;
  const isLoading = featuresQuery.isLoading;
  const isSaving = updateOverrides.isPending;

  const [pendingOverrides, setPendingOverrides] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Don't clobber the user's in-progress edits if a background refetch fires while
  // hasChanges is true. The effect re-runs after a successful save (hasChanges flips
  // back to false) and re-syncs from the server response.
  useEffect(() => {
    if (!data || hasChanges) return;
    setPendingOverrides(data.overrides ? { ...data.overrides } : {});
  }, [data, hasChanges]);

  const handleToggle = (key: FeatureKey, checked: boolean) => {
    const planDefault = data?.planDefaults?.[key] ?? false;

    setPendingOverrides((prev) => {
      const next = { ...prev };
      if (checked === planDefault) {
        delete next[key];
      } else {
        next[key] = checked;
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateOverrides.mutate(pendingOverrides, {
      onSuccess: () => {
        toast.success("Feature overrides saved");
        setHasChanges(false);
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Failed to save overrides"),
    });
  };

  const handleResetAll = () => {
    updateOverrides.mutate(
      {},
      {
        onSuccess: () => {
          toast.success("All overrides cleared - using plan defaults");
          setHasChanges(false);
        },
        onError: () => toast.error("Failed to reset overrides"),
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Feature Overrides
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const overrideCount = Object.keys(pendingOverrides).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Feature Overrides
            </CardTitle>
            <CardDescription>
              Override plan defaults for {organizationName}.
              {data.plan ? (
                <>
                  {" "}
                  Current plan: <Badge variant="outline">{data.plan.name}</Badge>
                </>
              ) : (
                " No plan assigned."
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {overrideCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleResetAll} disabled={isSaving}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset All
              </Button>
            )}
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Overrides
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {FEATURE_KEYS.map((key) => {
            const planDefault = data.planDefaults?.[key] ?? false;
            const isOverridden = key in pendingOverrides;
            const currentValue = isOverridden ? pendingOverrides[key] : planDefault;

            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  isOverridden ? "border-amber-500/50 bg-amber-500/5" : ""
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`override-${key}`} className="cursor-pointer font-medium">
                      {FEATURE_LABELS[key]}
                    </Label>
                    {isOverridden && (
                      <Badge
                        variant="outline"
                        className="text-xs text-amber-600 border-amber-500/50"
                      >
                        Overridden
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {FEATURE_DESCRIPTIONS[key]}
                    {data.planDefaults && (
                      <span className="ml-1">(Plan default: {planDefault ? "on" : "off"})</span>
                    )}
                  </p>
                </div>
                <Switch
                  id={`override-${key}`}
                  checked={currentValue}
                  onCheckedChange={(checked) => handleToggle(key, checked)}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
