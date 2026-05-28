"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Ribbon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ribbon {
  id: string;
  name: string;
  description: string | null;
  stage: number;
  dimension: string;
  templateId: string;
  requiredCount: number;
  passedCount: number;
  percentage: number;
  earned: boolean;
  earnedAt: string | null;
}

interface ApiResponse {
  ribbons: Ribbon[];
  summary: { total: number; earned: number };
}

interface CanSkateRibbonsCardProps {
  athleteId: string;
}

// Ribbon dimension colours (mirror Skate Canada's official ribbon colours).
const DIMENSION_STYLE: Record<string, { bg: string; ring: string; text: string }> = {
  Balance: {
    bg: "bg-blue-100 dark:bg-blue-950/40",
    ring: "ring-blue-400/60",
    text: "text-blue-700 dark:text-blue-300",
  },
  Control: {
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    ring: "ring-emerald-400/60",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  Agility: {
    bg: "bg-rose-100 dark:bg-rose-950/40",
    ring: "ring-rose-400/60",
    text: "text-rose-700 dark:text-rose-300",
  },
  Achievement: {
    bg: "bg-slate-100 dark:bg-slate-800/60",
    ring: "ring-slate-400/60",
    text: "text-slate-700 dark:text-slate-300",
  },
};

export function CanSkateRibbonsCard({ athleteId }: CanSkateRibbonsCardProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/athletes/${athleteId}/canskate-ribbons`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  // Group ribbons by stage for the grid layout
  const byStage = useMemo(() => {
    const map = new Map<number, Ribbon[]>();
    for (const r of data?.ribbons ?? []) {
      const list = map.get(r.stage) ?? [];
      list.push(r);
      map.set(r.stage, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [data]);

  if (loading || (!data && !error)) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5" />
            CanSkate Ribbons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading ribbon progress…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5" />
            CanSkate Ribbons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.ribbons.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5" />
            CanSkate Ribbons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            CanSkate ribbon catalog is not configured for this organization.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary } = data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-5 w-5" />
          CanSkate Ribbons
          <Badge variant="outline" className="ml-auto">
            {summary.earned} / {summary.total} earned
          </Badge>
        </CardTitle>
        <CardDescription>
          Skate Canada ribbon progression — Balance, Control, and Agility ribbons per stage. Earned
          automatically when an evaluation passes every required goal on a test sheet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {byStage.map(([stage, ribbons]) => (
          <div key={stage} className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stage === 0 ? "Pre-CanSkate" : `CanSkate Stage ${stage}`}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {ribbons.map((r) => {
                const style = DIMENSION_STYLE[r.dimension] ?? DIMENSION_STYLE.Achievement;
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-lg border p-3 transition-shadow",
                      r.earned ? `${style.bg} ring-2 ${style.ring}` : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={cn(
                          "text-xs font-semibold flex items-center gap-1.5",
                          r.earned ? style.text : "text-muted-foreground"
                        )}
                      >
                        {r.earned && <Ribbon className={cn("h-4 w-4", style.text)} />}
                        {r.dimension}
                      </span>
                    </div>
                    {r.earned ? (
                      <p className="text-[11px] text-muted-foreground">
                        Earned{" "}
                        {r.earnedAt
                          ? new Date(r.earnedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""}
                      </p>
                    ) : (
                      <>
                        <Progress value={r.percentage} className="h-1.5 mt-1" />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {r.passedCount} / {r.requiredCount} goals
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
