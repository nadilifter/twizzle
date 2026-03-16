"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  format,
  parseISO,
  differenceInMinutes,
} from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Loader2,
  ClipboardList,
  FileText,
  Mail,
  Plus,
  Star,
  Award,
  ExternalLink,
} from "lucide-react";
import { useFeatures } from "@/components/feature-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { toast } from "sonner";

interface EvaluationTemplateSkillInfo {
  id: string;
  skill: { id: string; name: string; category: string };
  order: number;
}

interface EvaluationTemplateInfo {
  id: string;
  name: string;
  scoringType: "PASS_FAIL" | "POINT_SCALE";
  pointScaleMin: number;
  pointScaleMax: number;
  pointScalePassThreshold: number;
  skills: EvaluationTemplateSkillInfo[];
}

interface ProgramEvaluationTemplateAssignment {
  id: string;
  templateId: string;
  template: EvaluationTemplateInfo;
}

interface InstanceEvaluation {
  id: string;
  athleteId: string;
  status: string;
  overallScore: number;
  notes: string | null;
  athlete: { id: string; name: string; avatar: string | null };
  template: EvaluationTemplateInfo | null;
  skillRatings: Array<{
    id: string;
    skillId: string;
    attemptStatus: "NOT_ATTEMPTED" | "ATTEMPTED" | "SUCCEEDED";
    pointScore: number | null;
    passed: boolean;
    skill: { id: string; name: string; category: string };
  }>;
}

interface ProgramInstance {
  id: string;
  programId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  status: string;
  notes: string | null;
  program: {
    id: string;
    name: string;
    description: string | null;
    basePrice: number | null;
    perSessionPrice: number | null;
    registrationType: string;
    evaluationTemplates?: ProgramEvaluationTemplateAssignment[];
  };
  facility: {
    id: string;
    name: string;
    city: string | null;
  } | null;
  registrations: Registration[];
  attendances: Attendance[];
  _count: {
    registrations: number;
    attendances: number;
  };
}

interface Registration {
  id: string;
  status: string;
  createdAt: string;
  athlete: {
    id: string;
    name: string;
    birthDate: string | null;
    avatar: string | null;
  };
  user: {
    id: string;
    name: string;
  } | null;
}

interface Attendance {
  id: string;
  status: string;
  checkedIn: string | null;
  notes: string | null;
  athlete: {
    id: string;
    name: string;
  };
}

export default function InstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.instanceId as string;
  const { isFeatureEnabled } = useFeatures();
  const trainingEnabled = isFeatureEnabled("training");

  const [instance, setInstance] = useState<ProgramInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("registrations");
  const [updateLoading, setUpdateLoading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [instanceNotes, setInstanceNotes] = useState("");

  // Evaluation state
  const [evaluations, setEvaluations] = useState<InstanceEvaluation[]>([]);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const [savingEvals, setSavingEvals] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set());
  const [evalsDirty, setEvalsDirty] = useState(false);
  const [detailEvaluation, setDetailEvaluation] = useState<InstanceEvaluation | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailNotes, setDetailNotes] = useState("");
  const [detailStatus, setDetailStatus] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);

  useBreadcrumbOverride(
    instance ? `/dashboard/calendar/instance/${instanceId}` : undefined,
    instance?.program.name,
  );

  const fetchInstance = useCallback(async () => {
    try {
      // First get the program ID from a simpler endpoint
      const response = await fetch(`/api/calendar/instance/${instanceId}`);
      if (!response.ok) throw new Error("Failed to fetch instance");
      const data = await response.json();
      setInstance(data);
      setInstanceNotes(data.notes || "");
    } catch (error) {
      console.error("Error fetching instance:", error);
      toast.error("Failed to load session details");
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  const hasEvaluationTemplate = !!(instance?.program.evaluationTemplates && instance.program.evaluationTemplates.length > 0);
  const evaluationTemplate = hasEvaluationTemplate ? instance!.program.evaluationTemplates![0].template : null;

  const fetchEvaluations = useCallback(async () => {
    if (!instance || !hasEvaluationTemplate) return;
    setLoadingEvals(true);
    try {
      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}/evaluations`
      );
      if (response.ok) {
        const data = await response.json();
        setEvaluations(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching evaluations:", error);
    } finally {
      setLoadingEvals(false);
    }
  }, [instance, instanceId, hasEvaluationTemplate]);

  const autoCreateEvaluations = useCallback(async () => {
    if (!instance || !hasEvaluationTemplate) return;
    try {
      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}/evaluations`,
        { method: "POST" }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.created > 0) {
          fetchEvaluations();
        }
      }
    } catch (error) {
      console.error("Error auto-creating evaluations:", error);
    }
  }, [instance, instanceId, hasEvaluationTemplate, fetchEvaluations]);

  useEffect(() => {
    if (activeTab === "evaluations" && instance && hasEvaluationTemplate && evaluations.length === 0 && !loadingEvals) {
      autoCreateEvaluations().then(() => fetchEvaluations());
    }
  }, [activeTab, instance, hasEvaluationTemplate]);  // eslint-disable-line react-hooks/exhaustive-deps

  const updateSkillInGrid = (evaluationId: string, skillId: string, newStatus: "NOT_ATTEMPTED" | "ATTEMPTED" | "SUCCEEDED") => {
    setEvaluations(prev => prev.map(evalItem => {
      if (evalItem.id !== evaluationId) return evalItem;
      return {
        ...evalItem,
        skillRatings: evalItem.skillRatings.map(sr =>
          sr.skillId === skillId
            ? { ...sr, attemptStatus: newStatus, passed: newStatus === "SUCCEEDED" }
            : sr
        ),
      };
    }));
    setEvalsDirty(true);
  };

  const updatePointScoreInGrid = (evaluationId: string, skillId: string, score: number) => {
    const threshold = evaluationTemplate?.pointScalePassThreshold || 7;
    setEvaluations(prev => prev.map(evalItem => {
      if (evalItem.id !== evaluationId) return evalItem;
      return {
        ...evalItem,
        skillRatings: evalItem.skillRatings.map(sr =>
          sr.skillId === skillId
            ? { ...sr, pointScore: score, passed: score >= threshold, attemptStatus: "ATTEMPTED" as const }
            : sr
        ),
      };
    }));
    setEvalsDirty(true);
  };

  const cycleAttemptStatus = (current: string): "NOT_ATTEMPTED" | "ATTEMPTED" | "SUCCEEDED" => {
    if (current === "NOT_ATTEMPTED") return "ATTEMPTED";
    if (current === "ATTEMPTED") return "SUCCEEDED";
    return "NOT_ATTEMPTED";
  };

  const handleBulkSetSkill = (skillId: string, status: "NOT_ATTEMPTED" | "ATTEMPTED" | "SUCCEEDED") => {
    setEvaluations(prev => prev.map(evalItem => {
      if (!selectedAthleteIds.has(evalItem.athleteId)) return evalItem;
      return {
        ...evalItem,
        skillRatings: evalItem.skillRatings.map(sr =>
          sr.skillId === skillId
            ? { ...sr, attemptStatus: status, passed: status === "SUCCEEDED" }
            : sr
        ),
      };
    }));
    setEvalsDirty(true);
    toast.success(`Updated ${selectedAthleteIds.size} athletes`);
  };

  const handleBulkPassAll = () => {
    setEvaluations(prev => prev.map(evalItem => {
      if (!selectedAthleteIds.has(evalItem.athleteId)) return evalItem;
      return {
        ...evalItem,
        skillRatings: evalItem.skillRatings.map(sr => ({
          ...sr,
          attemptStatus: "SUCCEEDED" as const,
          passed: true,
        })),
      };
    }));
    setEvalsDirty(true);
    toast.success(`Marked all skills passed for ${selectedAthleteIds.size} athletes`);
  };

  const saveAllEvaluations = async () => {
    if (!instance) return;
    setSavingEvals(true);
    try {
      const payload = {
        evaluations: evaluations.map(evalItem => ({
          evaluationId: evalItem.id,
          skillRatings: evalItem.skillRatings.map(sr => ({
            skillId: sr.skillId,
            attemptStatus: sr.attemptStatus,
            pointScore: sr.pointScore,
            passed: sr.passed,
          })),
        })),
      };

      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}/evaluations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to save evaluations");
      toast.success("Evaluations saved");
      setEvalsDirty(false);
      fetchEvaluations();
    } catch (error) {
      console.error("Error saving evaluations:", error);
      toast.error("Failed to save evaluations");
    } finally {
      setSavingEvals(false);
    }
  };

  const openDetailSheet = (evalItem: InstanceEvaluation) => {
    setDetailEvaluation(evalItem);
    setDetailNotes(evalItem.notes || "");
    setDetailStatus(evalItem.status);
    setDetailSheetOpen(true);
  };

  const saveDetailEvaluation = async () => {
    if (!instance || !detailEvaluation) return;
    setDetailSaving(true);
    try {
      const payload = {
        evaluations: [{
          evaluationId: detailEvaluation.id,
          status: detailStatus,
          notes: detailNotes,
          skillRatings: detailEvaluation.skillRatings.map(sr => ({
            skillId: sr.skillId,
            attemptStatus: sr.attemptStatus,
            pointScore: sr.pointScore,
            passed: sr.passed,
          })),
        }],
      };

      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}/evaluations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to save evaluation");
      toast.success("Evaluation saved");
      setDetailSheetOpen(false);
      fetchEvaluations();
    } catch (error) {
      console.error("Error saving evaluation:", error);
      toast.error("Failed to save evaluation");
    } finally {
      setDetailSaving(false);
    }
  };

  const getAttemptStatusIcon = (status: string) => {
    switch (status) {
      case "SUCCEEDED":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "ATTEMPTED":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <XCircle className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  const updateRegistrationStatus = async (registrationId: string, status: string) => {
    if (!instance) return;
    setUpdateLoading(registrationId);
    try {
      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}/registrations/${registrationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!response.ok) throw new Error("Failed to update registration");
      toast.success("Registration updated");
      fetchInstance();
    } catch (error) {
      console.error("Error updating registration:", error);
      toast.error("Failed to update registration");
    } finally {
      setUpdateLoading(null);
    }
  };

  const markAttendance = async (athleteId: string, status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => {
    if (!instance) return;
    setUpdateLoading(athleteId);
    try {
      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}/attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            athleteId,
            status,
            checkedIn: status === "PRESENT" || status === "LATE",
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to mark attendance");
      toast.success("Attendance updated");
      fetchInstance();
    } catch (error) {
      console.error("Error marking attendance:", error);
      toast.error("Failed to mark attendance");
    } finally {
      setUpdateLoading(null);
    }
  };

  const updateInstanceStatus = async (status: string) => {
    if (!instance) return;
    try {
      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!response.ok) throw new Error("Failed to update instance");
      toast.success(`Session ${status.toLowerCase()}`);
      fetchInstance();
      setCancelDialogOpen(false);
    } catch (error) {
      console.error("Error updating instance:", error);
      toast.error("Failed to update session");
    }
  };

  const updateInstanceNotes = async () => {
    if (!instance) return;
    try {
      const response = await fetch(
        `/api/programs/${instance.programId}/instances/${instanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: instanceNotes }),
        }
      );
      if (!response.ok) throw new Error("Failed to update notes");
      toast.success("Notes saved");
      fetchInstance();
      setNotesDialogOpen(false);
    } catch (error) {
      console.error("Error updating notes:", error);
      toast.error("Failed to save notes");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      REGISTERED: "default",
      WAITLISTED: "secondary",
      CANCELLED: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getAttendanceIcon = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "ABSENT":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "LATE":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "EXCUSED":
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Session not found</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const registeredCount = instance.registrations.filter(r => r.status === "REGISTERED").length;
  const waitlistedCount = instance.registrations.filter(r => r.status === "WAITLISTED").length;
  const presentCount = instance.attendances.filter(a => a.status === "PRESENT" || a.status === "LATE").length;
  const duration = differenceInMinutes(
    parseISO(`2000-01-01T${instance.endTime}`),
    parseISO(`2000-01-01T${instance.startTime}`)
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{instance.program.name}</h1>
            <Badge
              variant={
                instance.status === "SCHEDULED"
                  ? "outline"
                  : instance.status === "COMPLETED"
                  ? "secondary"
                  : "destructive"
              }
            >
              {instance.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(parseISO(instance.date), "EEEE, MMMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {instance.startTime} - {instance.endTime} ({duration} min)
            </span>
            {instance.facility && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {instance.facility.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setNotesDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Notes
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions
                <MoreHorizontal className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/dashboard/registrations/programs/${instance.programId}`)}>
                <ClipboardList className="h-4 w-4 mr-2" />
                View Program
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail className="h-4 w-4 mr-2" />
                Email Attendees
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {instance.status === "SCHEDULED" && (
                <>
                  <DropdownMenuItem onClick={() => updateInstanceStatus("COMPLETED")}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Session
                  </DropdownMenuItem>
                </>
              )}
              {instance.status === "CANCELLED" && (
                <DropdownMenuItem onClick={() => updateInstanceStatus("SCHEDULED")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Restore Session
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {registeredCount}
              {instance.capacity && (
                <span className="text-sm font-normal text-muted-foreground">
                  / {instance.capacity}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waitlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <UserX className="h-5 w-5 text-muted-foreground" />
              {waitlistedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              {presentCount}
              {registeredCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  / {registeredCount}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(instance.program.perSessionPrice || instance.program.basePrice || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        {trainingEnabled && (
          <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
            <TabsTrigger value="registrations" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Roster & Attendance ({instance._count.registrations})
            </TabsTrigger>
            <TabsTrigger value="evaluations" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Evaluations
            </TabsTrigger>
          </ResponsiveTabsList>
        )}

        {/* Roster & Attendance Tab */}
        <TabsContent value="registrations" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Roster & Attendance</CardTitle>
                  <CardDescription>
                    Manage registrations and track attendance for this session
                  </CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Registration
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {instance.registrations.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No registrations yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Guardian</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Checked In</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instance.registrations.map((reg) => {
                      const attendance = instance.attendances.find(
                        a => a.athlete.id === reg.athlete.id
                      );
                      return (
                        <TableRow key={reg.id}>
                          <TableCell className="font-medium">
                            {reg.athlete.name}
                          </TableCell>
                          <TableCell>{reg.user?.name || "-"}</TableCell>
                          <TableCell>{getStatusBadge(reg.status)}</TableCell>
                          <TableCell>
                            {reg.status === "CANCELLED" ? (
                              <span className="text-muted-foreground">-</span>
                            ) : attendance ? (
                              <div className="flex items-center gap-2">
                                {getAttendanceIcon(attendance.status)}
                                <span>{attendance.status}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not marked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {attendance?.checkedIn
                              ? format(parseISO(attendance.checkedIn), "h:mm a")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {reg.status === "REGISTERED" && (
                                <Select
                                  value={attendance?.status || ""}
                                  onValueChange={(value) =>
                                    markAttendance(reg.athlete.id, value as any)
                                  }
                                  disabled={updateLoading === reg.athlete.id}
                                >
                                  <SelectTrigger className="w-[130px]">
                                    <SelectValue placeholder="Mark..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PRESENT">Present</SelectItem>
                                    <SelectItem value="ABSENT">Absent</SelectItem>
                                    <SelectItem value="LATE">Late</SelectItem>
                                    <SelectItem value="EXCUSED">Excused</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={updateLoading === reg.id}
                                  >
                                    {updateLoading === reg.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <MoreHorizontal className="h-4 w-4" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/dashboard/athletes/${reg.athlete.id}`)}
                                  >
                                    View Athlete
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {reg.status !== "REGISTERED" && reg.status !== "CANCELLED" && (
                                    <DropdownMenuItem
                                      onClick={() => updateRegistrationStatus(reg.id, "REGISTERED")}
                                    >
                                      Mark as Registered
                                    </DropdownMenuItem>
                                  )}
                                  {reg.status !== "CANCELLED" && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => updateRegistrationStatus(reg.id, "CANCELLED")}
                                    >
                                      Cancel Registration
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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

        {/* Evaluations Tab */}
        {trainingEnabled && <TabsContent value="evaluations" className="mt-4">
          {!hasEvaluationTemplate ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground mb-4">
                  No evaluation template is assigned to this program.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/registrations/programs/${instance.programId}/edit`)}
                >
                  Edit Program
                </Button>
              </CardContent>
            </Card>
          ) : loadingEvals ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading evaluations...</p>
              </CardContent>
            </Card>
          ) : evaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">No registered athletes to evaluate</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      {evaluationTemplate?.name}
                    </CardTitle>
                    <CardDescription>
                      {evaluationTemplate?.scoringType === "POINT_SCALE"
                        ? `Point scale ${evaluationTemplate.pointScaleMin}-${evaluationTemplate.pointScaleMax} (pass at ${evaluationTemplate.pointScalePassThreshold}+)`
                        : "Pass / Fail"
                      }
                      {" · "}{evaluationTemplate?.skills.length} skills · {evaluations.length} athletes
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {evalsDirty && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                        Unsaved changes
                      </Badge>
                    )}
                    <Button
                      onClick={saveAllEvaluations}
                      disabled={savingEvals || !evalsDirty}
                      size="sm"
                    >
                      {savingEvals && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Bulk Actions */}
                {selectedAthleteIds.size > 0 && evaluationTemplate?.scoringType === "PASS_FAIL" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                    <span className="text-sm font-medium">{selectedAthleteIds.size} selected</span>
                    <div className="h-4 w-px bg-border" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">Set Skill for Selected</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        {evaluationTemplate.skills.sort((a, b) => a.order - b.order).map(ts => (
                          <DropdownMenuItem key={ts.skill.id} asChild>
                            <div className="flex flex-col items-start gap-1 w-full p-0">
                              <span className="text-sm font-medium px-2 pt-1">{ts.skill.name}</span>
                              <div className="flex gap-1 px-2 pb-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={(e) => { e.stopPropagation(); handleBulkSetSkill(ts.skill.id, "SUCCEEDED"); }}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                  Pass
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={(e) => { e.stopPropagation(); handleBulkSetSkill(ts.skill.id, "ATTEMPTED"); }}
                                >
                                  <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" />
                                  Attempted
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={(e) => { e.stopPropagation(); handleBulkSetSkill(ts.skill.id, "NOT_ATTEMPTED"); }}
                                >
                                  <XCircle className="h-3 w-3 mr-1 text-muted-foreground" />
                                  Clear
                                </Button>
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" onClick={handleBulkPassAll}>
                      <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                      Pass All Skills
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAthleteIds(new Set())}
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}

                {/* Skill Matrix Grid */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 w-[200px] min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={
                                evaluations.length > 0 &&
                                selectedAthleteIds.size === evaluations.length
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAthleteIds(new Set(evaluations.map(e => e.athleteId)));
                                } else {
                                  setSelectedAthleteIds(new Set());
                                }
                              }}
                            />
                            <span>Athlete</span>
                          </div>
                        </TableHead>
                        {evaluationTemplate?.skills
                          .sort((a, b) => a.order - b.order)
                          .map(ts => (
                            <TableHead
                              key={ts.skill.id}
                              className="text-center min-w-[100px]"
                              title={`${ts.skill.name} (${ts.skill.category})`}
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-xs font-medium truncate max-w-[90px]">
                                  {ts.skill.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
                                  {ts.skill.category}
                                </span>
                              </div>
                            </TableHead>
                          ))}
                        <TableHead className="text-center w-[80px]">Status</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations.map(evalItem => (
                        <TableRow key={evalItem.id}>
                          <TableCell className="sticky left-0 bg-background z-10">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedAthleteIds.has(evalItem.athleteId)}
                                onCheckedChange={(checked) => {
                                  setSelectedAthleteIds(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(evalItem.athleteId);
                                    else next.delete(evalItem.athleteId);
                                    return next;
                                  });
                                }}
                              />
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={evalItem.athlete.avatar || undefined} />
                                <AvatarFallback className="text-xs">
                                  {evalItem.athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <button
                                className="text-sm font-medium hover:underline text-left"
                                onClick={() => openDetailSheet(evalItem)}
                              >
                                {evalItem.athlete.name}
                              </button>
                            </div>
                          </TableCell>
                          {evaluationTemplate?.skills
                            .sort((a, b) => a.order - b.order)
                            .map(ts => {
                              const sr = evalItem.skillRatings.find(r => r.skillId === ts.skill.id);
                              if (!sr) return <TableCell key={ts.skill.id} className="text-center">—</TableCell>;

                              if (evaluationTemplate.scoringType === "POINT_SCALE") {
                                return (
                                  <TableCell key={ts.skill.id} className="text-center">
                                    <div className="flex items-center justify-center">
                                      <input
                                        type="number"
                                        min={evaluationTemplate.pointScaleMin}
                                        max={evaluationTemplate.pointScaleMax}
                                        value={sr.pointScore ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                          updatePointScoreInGrid(evalItem.id, ts.skill.id, val);
                                        }}
                                        className={`w-12 h-8 text-center text-sm border rounded-md ${
                                          sr.passed
                                            ? "border-green-300 bg-green-50 text-green-700"
                                            : sr.pointScore !== null
                                            ? "border-red-300 bg-red-50 text-red-700"
                                            : "border-border"
                                        }`}
                                      />
                                    </div>
                                  </TableCell>
                                );
                              }

                              return (
                                <TableCell key={ts.skill.id} className="text-center">
                                  <button
                                    className="inline-flex items-center justify-center p-1 rounded-md hover:bg-muted transition-colors"
                                    onClick={() =>
                                      updateSkillInGrid(evalItem.id, ts.skill.id, cycleAttemptStatus(sr.attemptStatus))
                                    }
                                    title={sr.attemptStatus.replace("_", " ")}
                                  >
                                    {getAttemptStatusIcon(sr.attemptStatus)}
                                  </button>
                                </TableCell>
                              );
                            })}
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                evalItem.status === "PASS" || evalItem.status === "EXCELLENT"
                                  ? "default"
                                  : evalItem.status === "IN_PROGRESS"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {evalItem.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDetailSheet(evalItem)}
                              title="Open details"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>}
      </Tabs>

      {/* Cancel Session Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this session? All registered
              athletes will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Session
            </Button>
            <Button
              variant="destructive"
              onClick={() => updateInstanceStatus("CANCELLED")}
            >
              Cancel Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Notes</DialogTitle>
            <DialogDescription>
              Add notes for this session (visible to staff only)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={instanceNotes}
            onChange={(e) => setInstanceNotes(e.target.value)}
            placeholder="Add notes about this session..."
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateInstanceNotes}>Save Notes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Evaluation Details</SheetTitle>
            <SheetDescription>
              {detailEvaluation?.athlete.name} — {evaluationTemplate?.name}
            </SheetDescription>
          </SheetHeader>
          {detailEvaluation && (
            <ScrollArea className="h-[calc(100vh-220px)] pr-4">
              <div className="space-y-6 py-4">
                {/* Skills */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Skills Assessment</Label>
                  {detailEvaluation.skillRatings
                    .sort((a, b) => {
                      const templateSkills = evaluationTemplate?.skills || [];
                      const aOrder = templateSkills.find(ts => ts.skill.id === a.skillId)?.order ?? 0;
                      const bOrder = templateSkills.find(ts => ts.skill.id === b.skillId)?.order ?? 0;
                      return aOrder - bOrder;
                    })
                    .map(sr => (
                      <div key={sr.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{sr.skill.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{sr.skill.category}</span>
                          </div>
                          {sr.passed && (
                            <Badge variant="default" className="text-xs bg-green-500">Passed</Badge>
                          )}
                        </div>

                        {evaluationTemplate?.scoringType === "POINT_SCALE" ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <Slider
                                value={[sr.pointScore ?? evaluationTemplate.pointScaleMin]}
                                min={evaluationTemplate.pointScaleMin}
                                max={evaluationTemplate.pointScaleMax}
                                step={1}
                                onValueChange={([value]) => {
                                  setDetailEvaluation(prev => {
                                    if (!prev) return prev;
                                    const threshold = evaluationTemplate?.pointScalePassThreshold || 7;
                                    return {
                                      ...prev,
                                      skillRatings: prev.skillRatings.map(r =>
                                        r.skillId === sr.skillId
                                          ? { ...r, pointScore: value, passed: value >= threshold, attemptStatus: "ATTEMPTED" as const }
                                          : r
                                      ),
                                    };
                                  });
                                }}
                                className="flex-1"
                              />
                              <span className="text-sm font-medium w-8 text-right">
                                {sr.pointScore ?? "—"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Pass threshold: {evaluationTemplate.pointScalePassThreshold}
                            </p>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            {(["NOT_ATTEMPTED", "ATTEMPTED", "SUCCEEDED"] as const).map(status => (
                              <Button
                                key={status}
                                variant={sr.attemptStatus === status ? "default" : "outline"}
                                size="sm"
                                className={`text-xs ${
                                  sr.attemptStatus === status
                                    ? status === "SUCCEEDED"
                                      ? "bg-green-500 hover:bg-green-600"
                                      : status === "ATTEMPTED"
                                      ? "bg-yellow-500 hover:bg-yellow-600"
                                      : ""
                                    : ""
                                }`}
                                onClick={() => {
                                  setDetailEvaluation(prev => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      skillRatings: prev.skillRatings.map(r =>
                                        r.skillId === sr.skillId
                                          ? { ...r, attemptStatus: status, passed: status === "SUCCEEDED" }
                                          : r
                                      ),
                                    };
                                  });
                                }}
                              >
                                {status === "NOT_ATTEMPTED" ? "Not Attempted" : status === "ATTEMPTED" ? "Attempted" : "Passed"}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>

                {/* Overall Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Overall Status</Label>
                  <Select value={detailStatus} onValueChange={setDetailStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="PASS">Pass</SelectItem>
                      <SelectItem value="RETRY">Retry</SelectItem>
                      <SelectItem value="EXCELLENT">Excellent</SelectItem>
                      <SelectItem value="SATISFACTORY">Satisfactory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Notes</Label>
                  <Textarea
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    placeholder="Add notes about this evaluation..."
                    rows={3}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setDetailSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDetailEvaluation} disabled={detailSaving}>
              {detailSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Evaluation
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
