"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ClipboardList,
  Calendar,
  CheckCircle2,
  Circle,
  XCircle,
  Eye,
  Trophy,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { 
  EvaluationWithRelations, 
  EvaluationStatus,
  SkillAttemptStatus,
} from "@/types/evaluations";

interface Athlete {
  id: string;
  name: string;
  level: string;
}

const statusColors: Record<EvaluationStatus, string> = {
  PENDING: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  IN_PROGRESS: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PASS: "bg-green-500/10 text-green-700 dark:text-green-400",
  RETRY: "bg-red-500/10 text-red-700 dark:text-red-400",
  EXCELLENT: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  SATISFACTORY: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
};

const statusLabels: Record<EvaluationStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  PASS: "Pass",
  RETRY: "Retry",
  EXCELLENT: "Excellent",
  SATISFACTORY: "Satisfactory",
};

const attemptStatusIcons: Record<SkillAttemptStatus, typeof CheckCircle2> = {
  NOT_ATTEMPTED: Circle,
  ATTEMPTED: XCircle,
  SUCCEEDED: CheckCircle2,
};

const attemptStatusColors: Record<SkillAttemptStatus, string> = {
  NOT_ATTEMPTED: "text-muted-foreground",
  ATTEMPTED: "text-yellow-500",
  SUCCEEDED: "text-green-500",
};

const attemptStatusLabels: Record<SkillAttemptStatus, string> = {
  NOT_ATTEMPTED: "Not Attempted",
  ATTEMPTED: "Attempted",
  SUCCEEDED: "Passed",
};

export default function AthleteEvaluationsPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [evaluations, setEvaluations] = useState<EvaluationWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  
  // View evaluation state
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewEvaluation, setViewEvaluation] = useState<EvaluationWithRelations | null>(null);

  // Fetch athletes
  useEffect(() => {
    async function fetchAthletes() {
      setIsLoading(true);
      try {
        const response = await api.get<{ data: Athlete[] }>("/api/athletes");
        setAthletes(response.data);
        if (response.data.length > 0) {
          setSelectedAthleteId(response.data[0].id);
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

  // Fetch evaluations for selected athlete
  const fetchEvaluations = useCallback(async () => {
    if (!selectedAthleteId) return;
    
    setIsLoadingEvaluations(true);
    try {
      const response = await api.get<{ data: EvaluationWithRelations[] }>(
        `/api/athletes/${selectedAthleteId}/evaluations`
      );
      setEvaluations(response.data);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      toast.error("Failed to load evaluations");
    } finally {
      setIsLoadingEvaluations(false);
    }
  }, [selectedAthleteId]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  // Filter evaluations
  const upcomingEvaluations = evaluations.filter(
    e => e.status === "PENDING" || e.status === "IN_PROGRESS"
  );
  const completedEvaluations = evaluations.filter(
    e => !["PENDING", "IN_PROGRESS"].includes(e.status)
  );

  // Stats
  const totalEvaluations = evaluations.length;
  const passedCount = evaluations.filter(
    e => ["PASS", "EXCELLENT", "SATISFACTORY"].includes(e.status)
  ).length;
  const passRate = totalEvaluations > 0 
    ? Math.round((passedCount / totalEvaluations) * 100) 
    : 0;

  // Open view sheet
  const openView = (evaluation: EvaluationWithRelations) => {
    setViewEvaluation(evaluation);
    setIsViewOpen(true);
  };

  // Get status badge
  const getStatusBadge = (status: EvaluationStatus) => {
    return (
      <Badge className={statusColors[status]}>
        {statusLabels[status]}
      </Badge>
    );
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
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Athletes Found</h2>
        <p className="text-muted-foreground">
          You don&apos;t have any athletes registered yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Evaluations</h1>
          <p className="text-muted-foreground">View evaluation results and progress</p>
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEvaluations}</p>
                <p className="text-xs text-muted-foreground">Total Evaluations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{passedCount}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{passRate}%</p>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-2">
            <Clock className="h-4 w-4" />
            Upcoming ({upcomingEvaluations.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed ({completedEvaluations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {isLoadingEvaluations ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : upcomingEvaluations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Upcoming Evaluations</h3>
                <p className="text-muted-foreground text-center">
                  You don&apos;t have any pending evaluations at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingEvaluations.map((evaluation) => (
                <Card key={evaluation.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">
                            {evaluation.template?.name || evaluation.level}
                          </h3>
                          {getStatusBadge(evaluation.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(evaluation.date), "MMMM d, yyyy")}
                          </div>
                          <span>{evaluation.skillRatings?.length || 0} skills</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openView(evaluation)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {isLoadingEvaluations ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : completedEvaluations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Completed Evaluations</h3>
                <p className="text-muted-foreground text-center">
                  Completed evaluations will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedEvaluations.map((evaluation) => {
                const totalSkills = evaluation.skillRatings?.length || 0;
                const succeededSkills = evaluation.skillRatings?.filter(
                  sr => sr.attemptStatus === "SUCCEEDED"
                ).length || 0;
                const progressPercent = totalSkills > 0 
                  ? Math.round((succeededSkills / totalSkills) * 100) 
                  : 0;

                return (
                  <Card key={evaluation.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold">
                              {evaluation.template?.name || evaluation.level}
                            </h3>
                            {getStatusBadge(evaluation.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(evaluation.date), "MMMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openView(evaluation)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Skills Passed</span>
                          <span className="font-medium">{succeededSkills}/{totalSkills}</span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View Evaluation Sheet */}
      <Sheet open={isViewOpen} onOpenChange={setIsViewOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {viewEvaluation?.template?.name || viewEvaluation?.level}
            </SheetTitle>
            <SheetDescription>
              {viewEvaluation && format(new Date(viewEvaluation.date), "MMMM d, yyyy")}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-200px)] pr-4">
            {viewEvaluation && (
              <div className="space-y-6 py-4">
                {/* Summary */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                        {getStatusBadge(viewEvaluation.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Score</p>
                        <p className="text-2xl font-bold">
                          {Number(viewEvaluation.overallScore).toFixed(1)}/10
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Skills Results */}
                <div className="space-y-3">
                  <Label className="text-base">Skills</Label>
                  {viewEvaluation.skillRatings?.map((sr) => {
                    const Icon = attemptStatusIcons[sr.attemptStatus];
                    return (
                      <Card key={sr.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{sr.skill.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {sr.skill.category}
                              </p>
                            </div>
                            <div className={`flex items-center gap-1 ${attemptStatusColors[sr.attemptStatus]}`}>
                              <Icon className="h-5 w-5" />
                              <span className="text-sm font-medium">
                                {attemptStatusLabels[sr.attemptStatus]}
                              </span>
                            </div>
                          </div>
                          {sr.comment && (
                            <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                              {sr.comment}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Coach Notes */}
                {viewEvaluation.notes && (
                  <div className="space-y-2">
                    <Label>Coach Notes</Label>
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {viewEvaluation.notes}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Coach Info */}
                <div className="text-sm text-muted-foreground">
                  Evaluated by {viewEvaluation.coach.name}
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
