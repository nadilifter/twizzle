"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface DriftResponse {
  canonical: readonly string[];
  localCount: number;
  driftedCount: number;
  drifted: string[];
  driftedTemplates: Array<{ id: string; name: string; type: string }>;
}

/**
 * Compact banner that fetches /api/skate-canada/category-drift on mount and
 * surfaces any non-canonical local category names. Mounts wherever an admin
 * is about to do work that depends on canonical names (e.g. submission
 * queue page).
 *
 * Hidden when there's zero drift OR when the user dismisses it. No
 * persistence — re-renders fresh on each page load.
 */
export function CategoryDriftBanner() {
  const [data, setData] = useState<DriftResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<DriftResponse>("/api/skate-canada/category-drift")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        // Non-admin / no-org responses come back as 4xx — quietly do nothing.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          setError(null);
        } else {
          setError("Couldn't load category drift check.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || error || !data) return null;

  // No drift — surface a green confirmation badge instead of nothing, so the
  // admin knows the check ran.
  if (data.driftedCount === 0 && data.localCount > 0) {
    return (
      <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 flex items-start gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">All categories match Skate Canada canonical names.</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.localCount} category template{data.localCount === 1 ? "" : "s"} checked against
            Skate Canada&rsquo;s canonical list.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 -mt-1"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (data.driftedCount === 0) return null;

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="font-medium">
            {data.driftedCount} category{data.driftedCount === 1 ? "" : " names"} don&rsquo;t match
            Skate Canada&rsquo;s canonical list.
          </p>
          <p className="text-xs text-muted-foreground">
            Submissions referencing these categories will be rejected by the CRM. Rename them in{" "}
            <a
              href="/dashboard/competitions/categories"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Competition categories
            </a>{" "}
            before submitting.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {data.drifted.map((name) => (
              <code
                key={name}
                className="font-mono text-[11px] rounded border bg-background px-1.5 py-0.5"
              >
                {name}
              </code>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Canonical names: {data.canonical.join(" · ")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 -mt-1"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
