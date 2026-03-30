"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  type FeatureKey,
  type FeatureToggles,
} from "@/lib/feature-toggles";

interface FeatureOverridesProps {
  organizationId: string;
  organizationName: string;
}

interface FeatureData {
  plan: { id: string; name: string } | null;
  planDefaults: FeatureToggles | null;
  overrides: Record<string, boolean> | null;
  resolved: FeatureToggles;
}

export function FeatureOverrides({ organizationId, organizationName }: FeatureOverridesProps) {
  const [data, setData] = React.useState<FeatureData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingOverrides, setPendingOverrides] = React.useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/superadmin/organizations/${organizationId}/features`);
      if (!response.ok) throw new Error("Failed to fetch features");
      const result = await response.json();
      setData(result);
      setPendingOverrides(result.overrides ?? {});
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to load feature configuration");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = (key: FeatureKey, checked: boolean) => {
    const planDefault = data?.planDefaults?.[key] ?? false;

    setPendingOverrides((prev) => {
      const next = { ...prev };
      if (checked === planDefault) {
        // Matches plan default, remove override
        delete next[key];
      } else {
        next[key] = checked;
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/superadmin/organizations/${organizationId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureToggles: pendingOverrides }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save");
      }
      toast.success("Feature overrides saved");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save overrides");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAll = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/superadmin/organizations/${organizationId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureToggles: {} }),
      });
      if (!response.ok) throw new Error("Failed to reset");
      toast.success("All overrides cleared - using plan defaults");
      fetchData();
    } catch (error) {
      toast.error("Failed to reset overrides");
    } finally {
      setIsSaving(false);
    }
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
