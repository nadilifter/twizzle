"use client";

import { useFeatures } from "@/components/feature-context";
import { FEATURE_LABELS, type FeatureKey } from "@/lib/feature-toggles";
import { ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wraps content that requires a specific feature to be enabled.
 * If the feature is disabled, shows a fallback message instead of the children.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { features, isLoaded } = useFeatures();

  if (!isLoaded) return null;

  if (!features[feature]) {
    if (fallback) return <>{fallback}</>;
    return <FeatureNotAvailable feature={feature} />;
  }

  return <>{children}</>;
}

/**
 * Full-page "Feature Not Available" message.
 */
export function FeatureNotAvailable({ feature }: { feature: FeatureKey }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center py-8 space-y-4">
          <div className="rounded-full bg-muted p-4">
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{FEATURE_LABELS[feature]} Not Available</h2>
            <p className="text-sm text-muted-foreground">
              This feature is not included in your current plan. Contact your administrator to
              upgrade for access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
