"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Merge {
  id: string;
  duplicateId: string;
  duplicateSnapshot: {
    athlete: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
    };
    organizationAthlete: {
      level: string;
      status: string;
      federationName: string | null;
      federationMemberNumber: string | null;
    };
  };
  counts: Record<string, { rebound: number; deduplicated: number }>;
  reason: string | null;
  createdAt: string;
  mergedBy: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  } | null;
}

interface MergeHistoryProps {
  athleteId: string;
}

export function MergeHistory({ athleteId }: MergeHistoryProps) {
  const [merges, setMerges] = useState<Merge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    api
      .get<{ merges: Merge[] }>(`/api/athletes/${athleteId}/merges`)
      .then((data) => {
        if (cancelled) return;
        setMerges(data.merges);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load merge history");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-md border p-4 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive flex items-center gap-2">
        <Loader2 className="h-4 w-4" /> {error}
      </p>
    );
  }

  if (!merges.length) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No merges in this athlete&rsquo;s history.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {merges.map((m) => {
        const dup = m.duplicateSnapshot.athlete;
        const dupOA = m.duplicateSnapshot.organizationAthlete;
        const movedRows = Object.entries(m.counts)
          .filter(([, v]) => v.rebound > 0 || v.deduplicated > 0)
          .map(([table, v]) => ({
            table,
            total: v.rebound + v.deduplicated,
            rebound: v.rebound,
            dedup: v.deduplicated,
          }));
        const totalAffected = movedRows.reduce((s, r) => s + r.total, 0);

        return (
          <div key={m.id} className="rounded-md border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-muted p-2 mt-0.5">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  Merged{" "}
                  <span className="font-medium">
                    {dup.firstName} {dup.lastName}
                  </span>{" "}
                  into this athlete
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  {m.mergedBy && (
                    <>
                      {" "}
                      · by{" "}
                      <span className="inline-flex items-center gap-1">
                        <Avatar className="h-3.5 w-3.5">
                          <AvatarImage src={m.mergedBy.avatar ?? undefined} />
                          <AvatarFallback className="text-[8px]">
                            {(m.mergedBy.name ?? m.mergedBy.email)[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {m.mergedBy.name ?? m.mergedBy.email}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{dupOA.level}</Badge>
                {dupOA.federationMemberNumber && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {dupOA.federationName === "SKATE_CANADA"
                      ? "SC"
                      : dupOA.federationName === "USFS"
                        ? "USFS"
                        : dupOA.federationName === "ISU"
                          ? "ISU"
                          : "ID"}{" "}
                    {dupOA.federationMemberNumber}
                  </Badge>
                )}
              </div>
            </div>

            {m.reason && (
              <p className="text-xs text-muted-foreground border-l-2 border-muted pl-3">
                {m.reason}
              </p>
            )}

            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              {totalAffected === 0 ? (
                <span>No related rows on the duplicate.</span>
              ) : (
                <>
                  <span>{totalAffected} related rows moved</span>
                  {movedRows.slice(0, 4).map((r) => (
                    <span key={r.table} className="font-mono text-[10px]">
                      {r.table}: {r.rebound}
                      {r.dedup > 0 && <span className="text-muted-foreground/70">+{r.dedup}d</span>}
                    </span>
                  ))}
                  {movedRows.length > 4 && (
                    <span className="text-muted-foreground/70">+{movedRows.length - 4} more</span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
