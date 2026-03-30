"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { FlaskConical, X } from "lucide-react";
import { getFeatureStatus, isDemoFeature } from "@/lib/feature-status";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "demo-banner-dismissed";
const DISMISS_DURATION = 1000 * 60 * 30; // 30 minutes

/**
 * Displays a persistent toast notification on pages that use demo/mock data.
 * The toast can be dismissed and will stay dismissed for 30 minutes.
 */
export function DemoDataBanner() {
  const pathname = usePathname();
  const [hasShown, setHasShown] = React.useState(false);
  const toastIdRef = React.useRef<string | number | null>(null);

  React.useEffect(() => {
    // Check if we're on a demo feature page
    if (!isDemoFeature(pathname)) {
      // Dismiss any existing toast when navigating to a live page
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    // Check if already dismissed recently
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        return;
      }
    }

    // Get feature info for this path
    const featureConfig = getFeatureStatus(pathname);
    const description =
      featureConfig?.description || "This page is using demo data for preview purposes.";

    // Show persistent toast
    const id = toast(
      <div className="flex items-start gap-3">
        <FlaskConical className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Demo Data</p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          {featureConfig?.apiRoutes && featureConfig.apiRoutes.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Backend API available at{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                {featureConfig.apiRoutes[0]}
              </code>
            </p>
          )}
        </div>
      </div>,
      {
        duration: Infinity,
        id: "demo-data-banner",
        action: {
          label: "Dismiss",
          onClick: () => {
            localStorage.setItem(DISMISSED_KEY, Date.now().toString());
            toast.dismiss("demo-data-banner");
          },
        },
      }
    );

    toastIdRef.current = id;
    setHasShown(true);

    return () => {
      // Don't dismiss on unmount - let the toast persist during navigation
    };
  }, [pathname]);

  // This component doesn't render anything visible - it just manages the toast
  return null;
}

/**
 * A simpler inline banner that can be placed at the top of a page
 * for a more prominent demo data indicator
 */
export function DemoDataInlineBanner() {
  const pathname = usePathname();
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Check localStorage on mount
  React.useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        setIsDismissed(true);
      }
    }
  }, []);

  if (!isDemoFeature(pathname) || isDismissed) {
    return null;
  }

  const featureConfig = getFeatureStatus(pathname);
  const description =
    featureConfig?.description || "This page is using demo data for preview purposes.";

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setIsDismissed(true);
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex items-start gap-3">
      <FlaskConical className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Demo Data Mode</p>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{description}</p>
        {featureConfig?.apiRoutes && featureConfig.apiRoutes.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Backend API ready at{" "}
            <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded text-xs">
              {featureConfig.apiRoutes[0]}
            </code>
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
