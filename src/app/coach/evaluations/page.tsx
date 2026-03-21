"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useCoachAthletes } from "@/hooks/use-coach-athletes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Search,
  Calendar,
  FileText,
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  ClipboardList,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api-client";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import type { 
  EvaluationWithRelations, 
  EvaluationTemplateWithSkills, 
  EvaluationStatus,
  SkillAttemptStatus,
  ScoringType,
} from "@/types/evaluations";
import { Slider } from "@/components/ui/slider";

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
  SUCCEEDED: "Succeeded",
};

export default function CoachEvaluationsPage() {
  return <CoachEvaluationsContent />;
}

function CoachEvaluationsContent() {
  const { data: session } = useSession();
  const [evaluations, setEvaluations] = useState<EvaluationWithRelations[]>([]);
  const [templates, setTemplates] = useState<EvaluationTemplateWithSkills[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  
  // Assign evaluation state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [evaluationDate, setEvaluationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // Record results state
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationWithRelations | null>(null);
  const [skillRatings, setSkillRatings] = useState<Record<string, SkillAttemptStatus>>({});
  const [skillPointScores, setSkillPointScores] = useState<Record<string, number>>({});
  const [skillComments, setSkillComments] = useState<Record<string, string>>({});
  const [overallStatus, setOverallStatus] = useState<EvaluationStatus>("SATISFACTORY");
  const [overallNotes, setOverallNotes] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  
  // View evaluation state
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewEvaluation, setViewEvaluation] = useState<EvaluationWithRelations | null>(null);

  const { athletes, isLoading: loadingAthletes } = useCoachAthletes();

  // Fetch evaluations
  const fetchEvaluations = useCallback(async () => {
    if (!session?.user?.id) return;
    
    setIsLoading(true);
    try {
      const response = await api.get<{ data: EvaluationWithRelations[] }>("/api/evaluations", {
        coachId: session.user.id,
      });
      setEvaluations(response.data);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      toast.error("Failed to load evaluations");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Fetch templates
  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await api.get<{ data: EvaluationTemplateWithSkills[] }>("/api/evaluation-templates", {
        isActive: "true",
      });
      setTemplates(response.data);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((evaluation) => {
    const matchesSearch = evaluation.athlete.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || evaluation.status === statusFilter;
    const matchesTab = activeTab === "all" || 
      (activeTab === "pending" && (evaluation.status === "PENDING" || evaluation.status === "IN_PROGRESS")) ||
      (activeTab === "completed" && !["PENDING", "IN_PROGRESS"].includes(evaluation.status));
    return matchesSearch && matchesStatus && matchesTab;
  });

  // Open assign dialog
  const openAssign = () => {
    setSelectedAthleteId("");
    setSelectedTemplateId("");
    setEvaluationDate(format(new Date(), "yyyy-MM-dd"));
    fetchTemplates();
    setIsAssignOpen(true);
  };

  // Handle assign evaluation
  const handleAssign = async () => {
    if (!selectedAthleteId || !selectedTemplateId) {
      toast.error("Please select an athlete and template");
      return;
    }

    setIsAssigning(true);
    try {
      await api.post("/api/evaluations", {
        athleteId: selectedAthleteId,
        templateId: selectedTemplateId,
        date: evaluationDate,
        status: "PENDING",
      });
      
      toast.success("Evaluation assigned successfully");
      setIsAssignOpen(false);
      fetchEvaluations();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to assign evaluation";
      toast.error(message);
    } finally {
      setIsAssigning(false);
    }
  };

  // Open record results sheet
  const openRecord = (evaluation: EvaluationWithRelations) => {
    setSelectedEvaluation(evaluation);
    
    // Initialize skill ratings from existing data
    const ratings: Record<string, SkillAttemptStatus> = {};
    const pointScores: Record<string, number> = {};
    const comments: Record<string, string> = {};
    
    // Get default values based on template scoring config
    const template = evaluation.template;
    const defaultPointScore = template?.pointScaleMin || 1;
    
    evaluation.skillRatings?.forEach((sr) => {
      ratings[sr.skillId] = sr.attemptStatus;
      pointScores[sr.skillId] = sr.pointScore ?? defaultPointScore;
      if (sr.comment) {
        comments[sr.skillId] = sr.comment;
      }
    });
    
    setSkillRatings(ratings);
    setSkillPointScores(pointScores);
    setSkillComments(comments);
    setOverallStatus(evaluation.status === "PENDING" || evaluation.status === "IN_PROGRESS" 
      ? "SATISFACTORY" 
      : evaluation.status);
    setOverallNotes(evaluation.notes || "");
    setIsRecordOpen(true);
  };

  // Handle record results
  const handleRecordResults = async () => {
    if (!selectedEvaluation) return;

    setIsRecording(true);
    try {
      const template = selectedEvaluation.template;
      const scoringType: ScoringType = template?.scoringType || "PASS_FAIL";
      const passThreshold = template?.pointScalePassThreshold || 7;
      
      // Calculate overall score based on scoring type
      let overallScore = 0;
      const skillCount = Object.keys(skillRatings).length;
      
      if (scoringType === "POINT_SCALE") {
        // Average of point scores
        const pointScoresValues = Object.values(skillPointScores);
        if (pointScoresValues.length > 0) {
          overallScore = Math.round(
            pointScoresValues.reduce((a, b) => a + b, 0) / pointScoresValues.length * 10
          ) / 10;
        }
      } else {
        // Pass/fail: calculate based on attempt status
        const succeededCount = Object.values(skillRatings).filter(s => s === "SUCCEEDED").length;
        const attemptedCount = Object.values(skillRatings).filter(s => s === "ATTEMPTED").length;
        overallScore = skillCount > 0 
          ? Math.round((succeededCount * 10 + attemptedCount * 5) / skillCount * 10) / 10
          : 0;
      }

      // Build skill ratings with appropriate scoring
      const skillRatingsPayload = Object.entries(skillRatings).map(([skillId, attemptStatus]) => {
        const pointScore = skillPointScores[skillId];
        const passed = scoringType === "POINT_SCALE" 
          ? pointScore >= passThreshold 
          : attemptStatus === "SUCCEEDED";
        
        return {
          skillId,
          attemptStatus,
          pointScore: scoringType === "POINT_SCALE" ? pointScore : undefined,
          passed,
          comment: skillComments[skillId] || undefined,
        };
      });

      const response = await api.put<EvaluationWithRelations>(`/api/evaluations/${selectedEvaluation.id}`, {
        status: overallStatus,
        overallScore,
        notes: overallNotes || undefined,
        skillRatings: skillRatingsPayload,
      });
      
      // Check for newly awarded achievements
      if (response.newAchievements && response.newAchievements.length > 0) {
        response.newAchievements.forEach((achievement: { achievementName: string }) => {
          toast.success(`Achievement unlocked: ${achievement.achievementName}!`, {
            duration: 5000,
          });
        });
      }
      
      toast.success("Evaluation results recorded successfully");
      setIsRecordOpen(false);
      setSelectedEvaluation(null);
      fetchEvaluations();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to record results";
      toast.error(message);
    } finally {
      setIsRecording(false);
    }
  };

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

  // Stats
  const pendingCount = evaluations.filter(e => e.status === "PENDING" || e.status === "IN_PROGRESS").length;
  const completedCount = evaluations.filter(e => !["PENDING", "IN_PROGRESS"].includes(e.status)).length;
  const passedCount = evaluations.filter(e => ["PASS", "EXCELLENT", "SATISFACTORY"].includes(e.status)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Evaluations</h1>
          <p className="text-muted-foreground">Track athlete progress and assessments</p>
        </div>
        
        <Button onClick={openAssign}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Evaluation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{evaluations.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{passedCount}</p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 flex gap-4">
            <div className="flex-1 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search athletes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="EXCELLENT">Excellent</SelectItem>
                <SelectItem value="PASS">Pass</SelectItem>
                <SelectItem value="SATISFACTORY">Satisfactory</SelectItem>
                <SelectItem value="RETRY">Retry</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredEvaluations.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Evaluations Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {search || statusFilter !== "all" 
                      ? "Try adjusting your filters"
                      : "Assign your first evaluation to get started"}
                  </p>
                  {!search && statusFilter === "all" && (
                    <Button onClick={openAssign}>
                      <Plus className="h-4 w-4 mr-2" />
                      Assign Evaluation
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvaluations.map((evaluation) => {
                      const totalSkills = evaluation.skillRatings?.length || 0;
                      const succeededSkills = evaluation.skillRatings?.filter(
                        sr => sr.attemptStatus === "SUCCEEDED"
                      ).length || 0;
                      
                      return (
                        <TableRow key={evaluation.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={evaluation.athlete.avatar || undefined} alt={evaluation.athlete.name} />
                                <AvatarFallback>
                                  {evaluation.athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{evaluation.athlete.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {evaluation.template?.name || (typeof evaluation.level === 'object' ? evaluation.level?.name : evaluation.level)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(evaluation.date), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(evaluation.status)}
                          </TableCell>
                          <TableCell>
                            {totalSkills > 0 ? (
                              <span className="text-sm">
                                {succeededSkills}/{totalSkills} passed
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(evaluation.status === "PENDING" || evaluation.status === "IN_PROGRESS") ? (
                                <Button
                                  size="sm"
                                  onClick={() => openRecord(evaluation)}
                                >
                                  <ClipboardList className="h-4 w-4 mr-1" />
                                  Record
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openView(evaluation)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Evaluation Sheet */}
      <Sheet open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Assign Evaluation</SheetTitle>
            <SheetDescription>
              Select an athlete and evaluation template
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="athlete">Athlete *</Label>
              <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an athlete..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingAthletes ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : athletes.length === 0 ? (
                    <SelectItem value="none" disabled>No athletes found</SelectItem>
                  ) : (
                    athletes.map((athlete) => (
                      <SelectItem key={athlete.id} value={athlete.id}>
                        {athlete.name} - {athlete.level}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Evaluation Template *</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingTemplates ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : templates.length === 0 ? (
                    <SelectItem value="none" disabled>No templates found</SelectItem>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.skills.length} skills)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !evaluationDate && "text-muted-foreground")}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {evaluationDate ? format(new Date(evaluationDate + "T12:00:00Z"), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={evaluationDate ? new Date(evaluationDate + "T12:00:00Z") : undefined}
                    onSelect={(date) => setEvaluationDate(date ? format(date, "yyyy-MM-dd") : "")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {selectedTemplateId && (
              <div className="space-y-2">
                <Label>Skills in this template:</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {templates
                    .find((t) => t.id === selectedTemplateId)
                    ?.skills.map((ts) => (
                      <div key={ts.id} className="text-sm py-1">
                        {ts.skill.name}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          
          <SheetFooter>
            <Button onClick={handleAssign} disabled={isAssigning}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Evaluation
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Record Results Sheet */}
      <Sheet open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Record Evaluation Results</SheetTitle>
            <SheetDescription>
              {selectedEvaluation?.athlete.name} - {selectedEvaluation?.template?.name || (typeof selectedEvaluation?.level === 'object' ? selectedEvaluation?.level?.name : selectedEvaluation?.level)}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-200px)] pr-4">
            <div className="space-y-6 py-4">
              {/* Scoring Type Info */}
              {selectedEvaluation?.template && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium">
                    Scoring: {selectedEvaluation.template.scoringType === "POINT_SCALE" 
                      ? `Point Scale (${selectedEvaluation.template.pointScaleMin}-${selectedEvaluation.template.pointScaleMax}, pass at ${selectedEvaluation.template.pointScalePassThreshold}+)` 
                      : "Pass/Fail"}
                  </p>
                </div>
              )}
              
              {/* Skills */}
              <div className="space-y-4">
                <Label className="text-base">Skills Assessment</Label>
                {selectedEvaluation?.skillRatings?.map((sr) => {
                  const template = selectedEvaluation.template;
                  const scoringType: ScoringType = template?.scoringType || "PASS_FAIL";
                  const pointMin = template?.pointScaleMin || 1;
                  const pointMax = template?.pointScaleMax || 10;
                  const passThreshold = template?.pointScalePassThreshold || 7;
                  const currentPointScore = skillPointScores[sr.skillId] ?? pointMin;
                  const isPassing = scoringType === "POINT_SCALE" 
                    ? currentPointScore >= passThreshold 
                    : skillRatings[sr.skillId] === "SUCCEEDED";
                  
                  return (
                    <Card key={sr.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-medium">{sr.skill.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {sr.skill.category}{sr.skill.skillLevel ? ` • ${sr.skill.skillLevel.name}` : ""}
                            </CardDescription>
                          </div>
                          {isPassing && (
                            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Pass
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {scoringType === "POINT_SCALE" ? (
                          // Point Scale UI
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Score: {currentPointScore}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Pass: {passThreshold}+
                              </span>
                            </div>
                            <Slider
                              value={[currentPointScore]}
                              onValueChange={(value) => 
                                setSkillPointScores(prev => ({ ...prev, [sr.skillId]: value[0] }))
                              }
                              min={pointMin}
                              max={pointMax}
                              step={1}
                              className={isPassing ? "[&_[role=slider]]:bg-green-500" : ""}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{pointMin}</span>
                              <span>{pointMax}</span>
                            </div>
                          </div>
                        ) : (
                          // Pass/Fail UI
                          <RadioGroup
                            value={skillRatings[sr.skillId] || "NOT_ATTEMPTED"}
                            onValueChange={(value) => 
                              setSkillRatings(prev => ({ ...prev, [sr.skillId]: value as SkillAttemptStatus }))
                            }
                            className="flex gap-4"
                          >
                            {(["NOT_ATTEMPTED", "ATTEMPTED", "SUCCEEDED"] as SkillAttemptStatus[]).map((status) => {
                              const Icon = attemptStatusIcons[status];
                              return (
                                <div key={status} className="flex items-center space-x-2">
                                  <RadioGroupItem value={status} id={`${sr.skillId}-${status}`} />
                                  <Label 
                                    htmlFor={`${sr.skillId}-${status}`}
                                    className={`flex items-center gap-1 cursor-pointer ${attemptStatusColors[status]}`}
                                  >
                                    <Icon className="h-4 w-4" />
                                    <span className="text-xs">{attemptStatusLabels[status]}</span>
                                  </Label>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        )}
                        <Input
                          placeholder="Optional comment..."
                          value={skillComments[sr.skillId] || ""}
                          onChange={(e) => 
                            setSkillComments(prev => ({ ...prev, [sr.skillId]: e.target.value }))
                          }
                          className="text-sm"
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Overall Status */}
              <div className="space-y-2">
                <Label>Overall Status *</Label>
                <Select 
                  value={overallStatus} 
                  onValueChange={(v) => setOverallStatus(v as EvaluationStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXCELLENT">Excellent</SelectItem>
                    <SelectItem value="PASS">Pass</SelectItem>
                    <SelectItem value="SATISFACTORY">Satisfactory</SelectItem>
                    <SelectItem value="RETRY">Retry</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Overall Notes</Label>
                <Textarea
                  placeholder="Add overall feedback or observations..."
                  value={overallNotes}
                  onChange={(e) => setOverallNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
          
          <SheetFooter className="mt-4">
            <Button onClick={handleRecordResults} disabled={isRecording}>
              {isRecording && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* View Evaluation Sheet */}
      <Sheet open={isViewOpen} onOpenChange={setIsViewOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Evaluation Results</SheetTitle>
            <SheetDescription>
              {viewEvaluation?.athlete.name} - {viewEvaluation?.template?.name || (typeof viewEvaluation?.level === 'object' ? viewEvaluation?.level?.name : viewEvaluation?.level)}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-200px)] pr-4">
            {viewEvaluation && (
              <div className="space-y-6 py-4">
                {/* Summary */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{format(new Date(viewEvaluation.date), "MMMM d, yyyy")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(viewEvaluation.status)}
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-3">
                  <Label className="text-base">Skills Results</Label>
                  {viewEvaluation.template?.scoringType === "POINT_SCALE" && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Pass threshold: {viewEvaluation.template.pointScalePassThreshold}+
                    </p>
                  )}
                  {viewEvaluation.skillRatings?.map((sr) => {
                    const Icon = attemptStatusIcons[sr.attemptStatus];
                    const scoringType = viewEvaluation.template?.scoringType || "PASS_FAIL";
                    const passThreshold = viewEvaluation.template?.pointScalePassThreshold || 7;
                    const isPassing = scoringType === "POINT_SCALE" 
                      ? (sr.pointScore ?? 0) >= passThreshold 
                      : sr.attemptStatus === "SUCCEEDED";
                    
                    return (
                      <div key={sr.id} className="flex items-center justify-between py-2 border-b">
                        <div>
                          <p className="font-medium text-sm">{sr.skill.name}</p>
                          {sr.comment && (
                            <p className="text-xs text-muted-foreground">{sr.comment}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {scoringType === "POINT_SCALE" ? (
                            <Badge className={isPassing 
                              ? "bg-green-500/10 text-green-700 dark:text-green-400" 
                              : "bg-slate-500/10 text-slate-700 dark:text-slate-400"
                            }>
                              {sr.pointScore ?? "-"} / {viewEvaluation.template?.pointScaleMax || 10}
                            </Badge>
                          ) : (
                            <div className={`flex items-center gap-1 ${attemptStatusColors[sr.attemptStatus]}`}>
                              <Icon className="h-4 w-4" />
                              <span className="text-sm">{attemptStatusLabels[sr.attemptStatus]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Notes */}
                {viewEvaluation.notes && (
                  <div className="space-y-2">
                    <Label>Coach Notes</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {viewEvaluation.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
