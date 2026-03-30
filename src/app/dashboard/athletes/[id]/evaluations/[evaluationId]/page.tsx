"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MessageSquare,
  Star,
  Target,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";
import type { EvaluationWithRelations, EvaluationSkillRating, Level } from "@/types/evaluations";

// ─── Status Config ──────────────────────────────────────────────────

const EVALUATION_STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: Loader2,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PASS: {
    label: "Pass",
    icon: CheckCircle2,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  RETRY: {
    label: "Retry",
    icon: AlertCircle,
    className: "bg-red-50 text-destructive border-red-200",
  },
  EXCELLENT: {
    label: "Excellent",
    icon: Star,
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  SATISFACTORY: {
    label: "Satisfactory",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

const ATTEMPT_STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  NOT_ATTEMPTED: { label: "Not Attempted", icon: XCircle, className: "text-muted-foreground" },
  ATTEMPTED: { label: "Attempted", icon: Target, className: "text-yellow-600" },
  SUCCEEDED: { label: "Succeeded", icon: CheckCircle2, className: "text-green-600" },
};

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// ─── Page Component ─────────────────────────────────────────────────

export default function EvaluationDetailPage() {
  const params = useParams();
  const athleteId = typeof params.id === "string" ? params.id : "";
  const evaluationId = typeof params.evaluationId === "string" ? params.evaluationId : "";

  const [evaluation, setEvaluation] = React.useState<EvaluationWithRelations | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const athleteName = evaluation?.athlete?.name;
  const templateName = evaluation?.template?.name;
  const evalDate = evaluation ? format(new Date(evaluation.date), "MMM d, yyyy") : undefined;
  const breadcrumbLabel = templateName ? `${templateName} – ${evalDate}` : evalDate;

  useBreadcrumbOverride(evaluation ? `/dashboard/athletes/${athleteId}` : undefined, athleteName);
  useBreadcrumbOverride(
    evaluation ? `/dashboard/athletes/${athleteId}/evaluations/${evaluationId}` : undefined,
    breadcrumbLabel
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<EvaluationWithRelations>(`/api/evaluations/${evaluationId}`)
      .then((data) => {
        if (!cancelled) setEvaluation(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load evaluation");
          toast.error("Failed to load evaluation details");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [evaluationId]);

  const skillRatings = evaluation?.skillRatings ?? [];

  const groupedSkills = React.useMemo(() => {
    const groups: Record<string, EvaluationSkillRating[]> = {};
    for (const rating of skillRatings) {
      const category = rating.skill?.category ?? "Uncategorized";
      if (!groups[category]) groups[category] = [];
      groups[category].push(rating);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [skillRatings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading evaluation...</p>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Evaluation Not Found</h1>
        <p className="text-muted-foreground">{error ?? "Could not load this evaluation."}</p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/athletes/${athleteId}?tab=evaluations`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Evaluations
          </Link>
        </Button>
      </div>
    );
  }

  const level = evaluation.level ?? evaluation.template?.level ?? null;
  const passedCount = skillRatings.filter((r) => r.passed).length;
  const totalSkills = skillRatings.length;
  const passRate = totalSkills > 0 ? Math.round((passedCount / totalSkills) * 100) : 0;
  const statusConfig = EVALUATION_STATUS_CONFIG[evaluation.status] ?? {
    label: evaluation.status,
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground",
  };
  const StatusIcon = statusConfig.icon;
  const achievements = evaluation.athleteAchievements ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/athletes/${athleteId}?tab=evaluations`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Evaluations
          </Link>
        </Button>
      </div>

      {/* Report Card Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: Athlete + Evaluation Info */}
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 border-2 border-background shadow-sm shrink-0">
                <AvatarImage
                  src={evaluation.athlete?.avatar ?? undefined}
                  alt={athleteName ?? ""}
                />
                <AvatarFallback className="text-lg font-bold bg-primary/10">
                  {getInitials(athleteName ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold tracking-tight">
                    {templateName ?? "Evaluation"}
                  </h1>
                  <Badge variant="outline" className={statusConfig.className}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {athleteName ?? "Unknown"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(evaluation.date), "MMMM d, yyyy")}
                  </span>
                  {evaluation.coach?.name && (
                    <span className="flex items-center gap-1">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Coach: {evaluation.coach.name}
                    </span>
                  )}
                  {evaluation.program?.name && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {evaluation.program.name}
                    </span>
                  )}
                </div>
                {level && (
                  <div className="mt-0.5">
                    <LevelBadge level={level} />
                  </div>
                )}
              </div>
            </div>

            {/* Right: Score */}
            <div className="flex items-center gap-6 sm:text-right shrink-0">
              {Number(evaluation.overallScore) > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Score
                  </p>
                  <p className="text-3xl font-bold tabular-nums">
                    {Number(evaluation.overallScore).toFixed(1)}
                  </p>
                </div>
              )}
              {totalSkills > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Skills Passed
                  </p>
                  <p className="text-3xl font-bold tabular-nums">
                    {passedCount}
                    <span className="text-lg text-muted-foreground font-normal">
                      /{totalSkills}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats Row */}
      {totalSkills > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pass Rate</p>
                  <p className="text-2xl font-bold">{passRate}%</p>
                </div>
                <div
                  className={`rounded-full p-2.5 ${passRate >= 80 ? "bg-green-100" : passRate >= 50 ? "bg-yellow-100" : "bg-red-100"}`}
                >
                  <Target
                    className={`h-5 w-5 ${passRate >= 80 ? "text-green-700" : passRate >= 50 ? "text-yellow-700" : "text-red-700"}`}
                  />
                </div>
              </div>
              <Progress value={passRate} className="mt-3 h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Passed</p>
                  <p className="text-2xl font-bold text-green-600">{passedCount}</p>
                </div>
                <div className="rounded-full bg-green-100 p-2.5">
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Not Passed</p>
                  <p className="text-2xl font-bold text-red-600">{totalSkills - passedCount}</p>
                </div>
                <div className="rounded-full bg-red-100 p-2.5">
                  <XCircle className="h-5 w-5 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Skills</p>
                  <p className="text-2xl font-bold">{totalSkills}</p>
                </div>
                <div className="rounded-full bg-muted p-2.5">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skills Breakdown by Category */}
      {groupedSkills.length > 0 ? (
        <div className="flex flex-col gap-6">
          {groupedSkills.map(([category, ratings]) => {
            const catPassed = ratings.filter((r) => r.passed).length;
            return (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{category}</CardTitle>
                    <Badge variant="outline" className="font-normal">
                      {catPassed}/{ratings.length} passed
                    </Badge>
                  </div>
                  <Progress
                    value={ratings.length > 0 ? (catPassed / ratings.length) * 100 : 0}
                    className="mt-2 h-1.5"
                  />
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {ratings.map((rating, idx) => (
                      <React.Fragment key={rating.id}>
                        <SkillRatingRow rating={rating} />
                        {idx < ratings.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <h3 className="text-sm font-medium">No skill ratings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No skills were evaluated in this assessment.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5" />
              Achievements Earned
            </CardTitle>
            <CardDescription>
              {achievements.length} achievement{achievements.length === 1 ? "" : "s"} earned from
              this evaluation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.map((aa) => (
                <div
                  key={aa.id}
                  className="flex items-center gap-3 rounded-lg border p-3 bg-gradient-to-r from-amber-50/50 to-yellow-50/50"
                >
                  <div className="rounded-full bg-amber-100 p-2 shrink-0">
                    <Trophy className="h-4 w-4 text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {aa.achievement?.name ?? "Achievement"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Earned {format(new Date(aa.earnedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {evaluation.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5" />
              Coach Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {evaluation.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Skill Rating Row ───────────────────────────────────────────────

function SkillRatingRow({ rating }: { rating: EvaluationSkillRating }) {
  const attemptConfig =
    ATTEMPT_STATUS_CONFIG[rating.attemptStatus] ?? ATTEMPT_STATUS_CONFIG.NOT_ATTEMPTED;
  const AttemptIcon = attemptConfig.icon;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`shrink-0 ${rating.passed ? "text-green-600" : "text-muted-foreground/50"}`}
        >
          {rating.passed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${rating.passed ? "" : "text-muted-foreground"}`}>
            {rating.skill?.name ?? "Unknown Skill"}
          </p>
          {rating.comment && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[400px]">
              {rating.comment}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {rating.pointScore != null && (
          <Badge variant="outline" className="tabular-nums font-medium">
            {rating.pointScore} pts
          </Badge>
        )}
        <div className={`flex items-center gap-1 text-xs ${attemptConfig.className}`}>
          <AttemptIcon className="h-3.5 w-3.5" />
          <span>{attemptConfig.label}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Level Badge ────────────────────────────────────────────────────

function LevelBadge({ level }: { level: Level }) {
  return (
    <Badge
      variant="outline"
      className="text-[10px] uppercase tracking-wider font-semibold"
      style={
        level.color
          ? { borderColor: level.color, color: level.color, backgroundColor: `${level.color}15` }
          : undefined
      }
    >
      {level.name}
    </Badge>
  );
}
