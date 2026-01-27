"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useCoachAthletes } from "@/hooks/use-coach-athletes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Plus, 
  Star, 
  Search,
  Calendar,
  User,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "sonner";

type EvaluationStatus = "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY";

interface Evaluation {
  id: string;
  athleteId: string;
  coachId: string;
  date: string;
  level: string;
  overallScore: number;
  status: EvaluationStatus;
  notes: string | null;
  athlete: {
    id: string;
    name: string;
    level: string;
  };
  coach: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

export default function CoachEvaluationsPage() {
  const { data: session } = useSession();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [evaluationDate, setEvaluationDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [level, setLevel] = useState("");
  const [overallScore, setOverallScore] = useState<string>("5");
  const [status, setStatus] = useState<EvaluationStatus>("SATISFACTORY");
  const [notes, setNotes] = useState("");

  const { athletes, isLoading: loadingAthletes } = useCoachAthletes();

  // Fetch evaluations
  const fetchEvaluations = useCallback(async () => {
    if (!session?.user?.id) return;
    
    setIsLoading(true);
    try {
      const response = await api.get<{ data: Evaluation[] }>("/api/evaluations", {
        coachId: session.user.id,
      });
      setEvaluations(response.data);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((evaluation) => {
    const matchesSearch = evaluation.athlete.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || evaluation.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle create evaluation
  const handleCreateEvaluation = async () => {
    if (!selectedAthleteId || !level) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsCreating(true);
    try {
      await api.post("/api/evaluations", {
        athleteId: selectedAthleteId,
        date: evaluationDate,
        level,
        overallScore: parseFloat(overallScore),
        status,
        notes: notes || undefined,
      });
      
      toast.success("Evaluation created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      fetchEvaluations();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to create evaluation";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedAthleteId("");
    setEvaluationDate(format(new Date(), "yyyy-MM-dd"));
    setLevel("");
    setOverallScore("5");
    setStatus("SATISFACTORY");
    setNotes("");
  };

  // Get status badge
  const getStatusBadge = (status: EvaluationStatus) => {
    switch (status) {
      case "EXCELLENT":
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">Excellent</Badge>;
      case "PASS":
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400">Pass</Badge>;
      case "SATISFACTORY":
        return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Satisfactory</Badge>;
      case "RETRY":
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">Retry</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Render score stars
  const renderScoreStars = (score: number) => {
    const fullStars = Math.floor(score / 2);
    const hasHalfStar = score % 2 >= 1;
    
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < fullStars
                ? "fill-yellow-400 text-yellow-400"
                : i === fullStars && hasHalfStar
                ? "fill-yellow-400/50 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-muted-foreground">({score.toFixed(1)})</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Evaluations</h1>
          <p className="text-muted-foreground">Track athlete progress and assessments</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Evaluation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Evaluation</DialogTitle>
              <DialogDescription>
                Evaluate an athlete's progress and skills
              </DialogDescription>
            </DialogHeader>
            
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={evaluationDate}
                    onChange={(e) => setEvaluationDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="level">Level *</Label>
                  <Input
                    id="level"
                    placeholder="e.g., Bronze, Level 4"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="score">Overall Score (0-10)</Label>
                  <Input
                    id="score"
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={overallScore}
                    onChange={(e) => setOverallScore(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as EvaluationStatus)}>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any observations or feedback..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateEvaluation} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Evaluation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search athletes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="EXCELLENT">Excellent</SelectItem>
                <SelectItem value="PASS">Pass</SelectItem>
                <SelectItem value="SATISFACTORY">Satisfactory</SelectItem>
                <SelectItem value="RETRY">Retry</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{evaluations.length}</p>
            <p className="text-xs text-muted-foreground">Total Evaluations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">
              {evaluations.filter(e => e.status === "EXCELLENT" || e.status === "PASS").length}
            </p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-yellow-600">
              {evaluations.filter(e => e.status === "SATISFACTORY").length}
            </p>
            <p className="text-xs text-muted-foreground">Satisfactory</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">
              {evaluations.filter(e => e.status === "RETRY").length}
            </p>
            <p className="text-xs text-muted-foreground">Need Retry</p>
          </CardContent>
        </Card>
      </div>

      {/* Evaluations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredEvaluations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Evaluations Found</h3>
              <p className="text-muted-foreground mb-4">
                {search || statusFilter !== "all" 
                  ? "Try adjusting your filters"
                  : "Create your first evaluation to get started"}
              </p>
              {!search && statusFilter === "all" && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Evaluation
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {evaluation.athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{evaluation.athlete.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(evaluation.date), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{evaluation.level}</Badge>
                    </TableCell>
                    <TableCell>
                      {renderScoreStars(Number(evaluation.overallScore))}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(evaluation.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
