"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { Target, CheckCircle2, Circle, XCircle, TrendingUp, Award, Dumbbell } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type {
  AthleteSkillProgress as AthleteSkillProgressType,
  SkillAttemptStatus,
} from "@/types/evaluations";

interface Athlete {
  id: string;
  name: string;
  level: string;
}

interface SkillProgressResponse {
  data: AthleteSkillProgressType[];
  summary: {
    total: number;
    notAttempted: number;
    attempted: number;
    succeeded: number;
  };
  byCategory: Record<
    string,
    {
      total: number;
      notAttempted: number;
      attempted: number;
      succeeded: number;
    }
  >;
}

const attemptStatusIcons: Record<SkillAttemptStatus, typeof CheckCircle2> = {
  NOT_ATTEMPTED: Circle,
  ATTEMPTED: XCircle,
  SUCCEEDED: CheckCircle2,
};

const attemptStatusColors: Record<SkillAttemptStatus, string> = {
  NOT_ATTEMPTED: "text-muted-foreground bg-muted",
  ATTEMPTED: "text-yellow-600 bg-yellow-500/10",
  SUCCEEDED: "text-green-600 bg-green-500/10",
};

const attemptStatusLabels: Record<SkillAttemptStatus, string> = {
  NOT_ATTEMPTED: "Not Started",
  ATTEMPTED: "In Progress",
  SUCCEEDED: "Mastered",
};

export default function AthleteSkillsPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [skillProgress, setSkillProgress] = useState<AthleteSkillProgressType[]>([]);
  const [summary, setSummary] = useState<SkillProgressResponse["summary"] | null>(null);
  const [byCategory, setByCategory] = useState<SkillProgressResponse["byCategory"]>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusTab, setStatusTab] = useState("all");

  // Fetch athletes
  useEffect(() => {
    async function fetchAthletes() {
      setIsLoading(true);
      try {
        const response = await api.get<{
          athletes: Array<{ id: string; firstName: string; lastName: string; level: string }>;
        }>("/api/athletes/me");
        const athleteData = (response.athletes || []).map((a) => ({
          id: a.id,
          name: `${a.firstName} ${a.lastName}`.trim(),
          level: a.level,
        }));
        setAthletes(athleteData);
        if (athleteData.length > 0) {
          setSelectedAthleteId(athleteData[0].id);
        }
      } catch (error) {
        console.error("Error fetching athletes:", error);
        toast.error("Failed to load athletes");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAthletes();
  }, []);

  // Fetch skill progress for selected athlete
  const fetchSkillProgress = useCallback(async () => {
    if (!selectedAthleteId) return;

    setIsLoadingSkills(true);
    try {
      const response = await api.get<SkillProgressResponse>(
        `/api/athletes/${selectedAthleteId}/skills`
      );
      setSkillProgress(response.data);
      setSummary(response.summary);
      setByCategory(response.byCategory);
    } catch (error) {
      console.error("Error fetching skill progress:", error);
      toast.error("Failed to load skill progress");
    } finally {
      setIsLoadingSkills(false);
    }
  }, [selectedAthleteId]);

  useEffect(() => {
    fetchSkillProgress();
  }, [fetchSkillProgress]);

  // Get categories
  const categories = Object.keys(byCategory);

  // Filter skills by category
  const filteredSkills =
    selectedCategory === "all"
      ? skillProgress
      : skillProgress.filter((sp) => sp.skill.category === selectedCategory);

  // Group skills by status for display
  const skillsByStatus = {
    succeeded: filteredSkills.filter((sp) => sp.bestStatus === "SUCCEEDED"),
    attempted: filteredSkills.filter((sp) => sp.bestStatus === "ATTEMPTED"),
    notAttempted: filteredSkills.filter((sp) => sp.bestStatus === "NOT_ATTEMPTED"),
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Athletes Found</h2>
        <p className="text-muted-foreground">You don&apos;t have any athletes registered yet.</p>
      </div>
    );
  }

  const overallProgress = summary
    ? Math.round((summary.succeeded / Math.max(summary.total, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Skill Progress</h1>
          <p className="text-muted-foreground">Track skills and progression</p>
        </div>

        {athletes.length > 1 && (
          <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select athlete" />
            </SelectTrigger>
            <SelectContent>
              {athletes.map((athlete) => (
                <SelectItem key={athlete.id} value={athlete.id}>
                  {athlete.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Overall Progress */}
      {summary && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Overall Progress</h3>
                  <span className="text-2xl font-bold">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-3" />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{summary.succeeded} mastered</span>
                  <span>{summary.total} total skills</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 sm:w-auto">
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <p className="text-2xl font-bold text-green-600">{summary.succeeded}</p>
                  <p className="text-xs text-muted-foreground">Mastered</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-600">{summary.attempted}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-muted-foreground">{summary.notAttempted}</p>
                  <p className="text-xs text-muted-foreground">Not Started</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress by Category */}
      {categories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {categories.map((category) => {
            const catData = byCategory[category];
            const catProgress = Math.round((catData.succeeded / Math.max(catData.total, 1)) * 100);
            return (
              <Card
                key={category}
                className={`cursor-pointer transition-colors ${
                  selectedCategory === category ? "border-primary" : ""
                }`}
                onClick={() =>
                  setSelectedCategory(selectedCategory === category ? "all" : category)
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{catProgress}%</span>
                  </div>
                  <h4 className="font-medium text-sm mb-1">{category}</h4>
                  <Progress value={catProgress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {catData.succeeded}/{catData.total} skills
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Skills List */}
      <Tabs value={statusTab} onValueChange={setStatusTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <ResponsiveTabsList value={statusTab} onValueChange={setStatusTab}>
            <TabsTrigger value="all">All ({filteredSkills.length})</TabsTrigger>
            <TabsTrigger value="mastered" className="text-green-600">
              Mastered ({skillsByStatus.succeeded.length})
            </TabsTrigger>
            <TabsTrigger value="progress" className="text-yellow-600">
              In Progress ({skillsByStatus.attempted.length})
            </TabsTrigger>
            <TabsTrigger value="notstarted">
              Not Started ({skillsByStatus.notAttempted.length})
            </TabsTrigger>
          </ResponsiveTabsList>

          {selectedCategory !== "all" && (
            <Badge
              variant="outline"
              className="cursor-pointer"
              onClick={() => setSelectedCategory("all")}
            >
              {selectedCategory} ×
            </Badge>
          )}
        </div>

        {isLoadingSkills ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            <TabsContent value="all">
              <SkillsGrid skills={filteredSkills} />
            </TabsContent>
            <TabsContent value="mastered">
              <SkillsGrid skills={skillsByStatus.succeeded} emptyMessage="No mastered skills yet" />
            </TabsContent>
            <TabsContent value="progress">
              <SkillsGrid skills={skillsByStatus.attempted} emptyMessage="No skills in progress" />
            </TabsContent>
            <TabsContent value="notstarted">
              <SkillsGrid
                skills={skillsByStatus.notAttempted}
                emptyMessage="All skills have been attempted!"
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

// Skills Grid Component
function SkillsGrid({
  skills,
  emptyMessage = "No skills found",
}: {
  skills: AthleteSkillProgressType[];
  emptyMessage?: string;
}) {
  if (skills.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {skills.map((sp) => {
        const Icon = attemptStatusIcons[sp.bestStatus];
        return (
          <Card key={sp.skillId}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium">{sp.skill.name}</h4>
                  <p className="text-sm text-muted-foreground">{sp.skill.category}</p>
                </div>
                <div className={`p-2 rounded-full ${attemptStatusColors[sp.bestStatus]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {sp.skill.skillLevel && (
                  <Badge
                    style={
                      sp.skill.skillLevel.color
                        ? {
                            backgroundColor: `${sp.skill.skillLevel.color}20`,
                            color: sp.skill.skillLevel.color,
                          }
                        : undefined
                    }
                    variant={sp.skill.skillLevel.color ? "outline" : "secondary"}
                  >
                    {sp.skill.skillLevel.name}
                  </Badge>
                )}
                <Badge variant="outline" className={attemptStatusColors[sp.bestStatus]}>
                  {attemptStatusLabels[sp.bestStatus]}
                </Badge>
              </div>

              {sp.bestStatus !== "NOT_ATTEMPTED" && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {sp.firstAttemptedAt && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      First attempt: {format(new Date(sp.firstAttemptedAt), "MMM d, yyyy")}
                    </div>
                  )}
                  {sp.firstSucceededAt && (
                    <div className="flex items-center gap-1">
                      <Award className="h-3 w-3 text-green-500" />
                      Mastered: {format(new Date(sp.firstSucceededAt), "MMM d, yyyy")}
                    </div>
                  )}
                  <div>
                    Attempts: {sp.attemptCount} | Successes: {sp.successCount}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
