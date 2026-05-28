"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, BadgeCheck, CheckCircle2, ExternalLink, Star } from "lucide-react";
import { format } from "date-fns";
import { CanSkateRibbonsCard } from "@/components/athletes/canskate-ribbons-card";
import { athleteDisplayName } from "@/lib/athlete-name";
import { calculateAge } from "@/lib/age-utils";
import { getClientSubdomainUrl } from "@/lib/client-domains";
import { cn } from "@/lib/utils";

interface AthleteSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  birthDate: string | null;
  avatar: string | null;
  level: string;
  status: string;
  federationName: string | null;
  federationMemberNumber: string | null;
  federationMemberExpiresAt: string | null;
}

interface EvaluationSummary {
  id: string;
  date: string;
  status: string;
  template?: { id: string; name: string } | null;
  overallScore: number | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CoachAthleteDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [athlete, setAthlete] = useState<AthleteSummary | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/athletes/${id}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Athlete not found" : `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setAthlete({
          id: data.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          birthDate: data.birthDate,
          avatar: data.avatar,
          level: data.level,
          status: data.status,
          federationName: data.federationName ?? null,
          federationMemberNumber: data.federationMemberNumber ?? null,
          federationMemberExpiresAt: data.federationMemberExpiresAt ?? null,
        });
        setEvaluations(
          Array.isArray(data.evaluations)
            ? (data.evaluations as EvaluationSummary[]).slice(0, 5)
            : []
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load athlete");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="flex flex-col gap-4 p-6 max-w-5xl mx-auto w-full">
        <Button variant="ghost" size="sm" onClick={() => router.push("/coach/athletes")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to athletes
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error ?? "Athlete not found."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName = athleteDisplayName(athlete) || athlete.email || "Unnamed athlete";
  const age = athlete.birthDate ? calculateAge(athlete.birthDate) : null;
  const fedExpired = athlete.federationMemberExpiresAt
    ? new Date(athlete.federationMemberExpiresAt) < new Date()
    : false;
  const fedLabel =
    athlete.federationName === "SKATE_CANADA"
      ? "Skate Canada"
      : athlete.federationName === "USFS"
        ? "U.S. Figure Skating"
        : athlete.federationName === "ISU"
          ? "ISU"
          : null;

  const adminProfileUrl = `${getClientSubdomainUrl("admin")}/dashboard/athletes/${athlete.id}`;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <Button
        variant="ghost"
        size="sm"
        className="self-start -ml-2"
        onClick={() => router.push("/coach/athletes")}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to athletes
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={athlete.avatar ?? undefined} alt={fullName} />
            <AvatarFallback className="bg-primary/10">{getInitials(fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight truncate">{fullName}</h1>
              {athlete.level && athlete.level !== "Unassigned" && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider h-5 px-1.5"
                >
                  {athlete.level}
                </Badge>
              )}
              <Badge
                variant={athlete.status === "ACTIVE" ? "default" : "secondary"}
                className="text-[10px] uppercase tracking-wider h-5 px-1.5"
              >
                {formatStatus(athlete.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-x-1.5 flex-wrap text-sm text-muted-foreground mt-1">
              {athlete.birthDate && (
                <>
                  <span>
                    {format(new Date(athlete.birthDate), "MMM d, yyyy")}
                    {age !== null && (
                      <span className="text-foreground font-medium ml-1">({age} yrs)</span>
                    )}
                  </span>
                  {athlete.email && <span className="text-border">·</span>}
                </>
              )}
              {athlete.email && <span className="truncate">{athlete.email}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={adminProfileUrl} target="_blank" rel="noopener noreferrer">
            Full profile
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>

      {/* Federation Membership */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="h-5 w-5" />
            Federation Membership
            {athlete.federationMemberNumber && !fedExpired && (
              <Badge
                variant="outline"
                className="ml-auto bg-green-50 text-green-700 border-green-200"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
            {athlete.federationMemberNumber && fedExpired && (
              <Badge variant="destructive" className="ml-auto">
                Expired
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {athlete.federationMemberNumber ? (
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Federation</p>
                <p className="font-medium">{fedLabel ?? athlete.federationName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Member Number</p>
                <p className="font-medium font-mono">{athlete.federationMemberNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Expires</p>
                <p className={cn("font-medium", fedExpired && "text-destructive")}>
                  {athlete.federationMemberExpiresAt
                    ? format(new Date(athlete.federationMemberExpiresAt), "MMM d, yyyy")
                    : "No expiry"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No federation membership on file.</p>
          )}
        </CardContent>
      </Card>

      {/* CanSkate Ribbons */}
      <CanSkateRibbonsCard athleteId={athlete.id} />

      {/* Recent Evaluations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-5 w-5" />
            Recent Evaluations
          </CardTitle>
          <CardDescription>
            Most recent 5 — record new ones from the Evaluations tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evaluations recorded yet.</p>
          ) : (
            <div className="divide-y">
              {evaluations.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {e.template?.name ?? "Untitled template"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.date), "MMM d, yyyy")}
                      {e.overallScore !== null && (
                        <span className="ml-2">Score: {e.overallScore}</span>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline">{formatStatus(e.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
