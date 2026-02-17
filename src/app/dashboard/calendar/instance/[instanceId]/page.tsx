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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
    recurrenceType: string;
    registrationType: string;
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
  family: {
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
      ATTENDED: "default",
      NO_SHOW: "destructive",
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
        <TabsList>
          <TabsTrigger value="registrations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Registrations ({instance._count.registrations})
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          {trainingEnabled && (
            <TabsTrigger value="evaluations" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Evaluations
            </TabsTrigger>
          )}
        </TabsList>

        {/* Registrations Tab */}
        <TabsContent value="registrations" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Registrations</CardTitle>
                  <CardDescription>
                    Athletes registered for this session
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
                      <TableHead>Family</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instance.registrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">
                          {reg.athlete.name}
                        </TableCell>
                        <TableCell>{reg.family?.name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(reg.status)}</TableCell>
                        <TableCell>
                          {format(parseISO(reg.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
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
                              {reg.status !== "REGISTERED" && (
                                <DropdownMenuItem
                                  onClick={() => updateRegistrationStatus(reg.id, "REGISTERED")}
                                >
                                  Mark as Registered
                                </DropdownMenuItem>
                              )}
                              {reg.status !== "ATTENDED" && (
                                <DropdownMenuItem
                                  onClick={() => updateRegistrationStatus(reg.id, "ATTENDED")}
                                >
                                  Mark as Attended
                                </DropdownMenuItem>
                              )}
                              {reg.status !== "NO_SHOW" && (
                                <DropdownMenuItem
                                  onClick={() => updateRegistrationStatus(reg.id, "NO_SHOW")}
                                >
                                  Mark as No Show
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Attendance</CardTitle>
                  <CardDescription>
                    Track attendance for registered athletes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {instance.registrations.filter(r => r.status === "REGISTERED" || r.status === "ATTENDED").length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No registered athletes to track</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Registration Status</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Checked In</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instance.registrations
                      .filter(r => r.status === "REGISTERED" || r.status === "ATTENDED" || r.status === "NO_SHOW")
                      .map((reg) => {
                        const attendance = instance.attendances.find(
                          a => a.athlete.id === reg.athlete.id
                        );
                        return (
                          <TableRow key={reg.id}>
                            <TableCell className="font-medium">
                              {reg.athlete.name}
                            </TableCell>
                            <TableCell>{getStatusBadge(reg.status)}</TableCell>
                            <TableCell>
                              {attendance ? (
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Evaluations</CardTitle>
                  <CardDescription>
                    Evaluate athlete skills and track progress for this session
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {instance.registrations.filter(r => r.status === "REGISTERED" || r.status === "ATTENDED").length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No athletes to evaluate</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Quick Evaluation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instance.registrations
                      .filter(r => r.status === "REGISTERED" || r.status === "ATTENDED")
                      .map((reg) => {
                        const attendance = instance.attendances.find(
                          a => a.athlete.id === reg.athlete.id
                        );
                        const isPresent = attendance?.status === "PRESENT" || attendance?.status === "LATE";
                        return (
                          <TableRow key={reg.id}>
                            <TableCell className="font-medium">
                              {reg.athlete.name}
                            </TableCell>
                            <TableCell>
                              {attendance ? (
                                <div className="flex items-center gap-2">
                                  {getAttendanceIcon(attendance.status)}
                                  <span className="text-sm">{attendance.status}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Not marked</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!isPresent}
                                  className="gap-1"
                                  onClick={() => router.push(`/dashboard/training/evaluations?athleteId=${reg.athlete.id}&programId=${instance.programId}&date=${instance.date}`)}
                                >
                                  <Star className="h-3 w-3" />
                                  Evaluate
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/dashboard/athletes/${reg.athlete.id}`)}
                                  >
                                    <Users className="h-4 w-4 mr-2" />
                                    View Athlete Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/dashboard/athletes/${reg.athlete.id}?tab=evaluations`)}
                                  >
                                    <ClipboardList className="h-4 w-4 mr-2" />
                                    View All Evaluations
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/dashboard/athletes/${reg.athlete.id}?tab=achievements`)}
                                  >
                                    <Award className="h-4 w-4 mr-2" />
                                    View Achievements
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/dashboard/training/evaluations?athleteId=${reg.athlete.id}`)}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Full Evaluation Form
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
}
