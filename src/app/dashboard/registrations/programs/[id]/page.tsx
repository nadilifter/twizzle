"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sanitizeHtml } from "@/lib/sanitize";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Edit,
  MoreHorizontal,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { toast } from "sonner";

interface Program {
  id: string;
  name: string;
  description: string | null;
  status: string;
  registrationType: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  duration: number | null;
  capacity: number | null;
  basePrice: number | null;
  perSessionPrice: number | null;
  pricingModel: string;
  billingInterval: string;
  recurringPrice: number | null;
  waitlistEnabled: boolean;
  waitlistAutoPromote: boolean;
  waitlistCapacity: number | null;
  facility: { id: string; name: string; city?: string } | null;
  _count: {
    instances: number;
    enrollments: number;
  };
}

interface Instance {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number | null;
  notes: string | null;
  facility: { id: string; name: string; city?: string } | null;
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
    email: string | null;
    avatar: string | null;
  };
  user: {
    id: string;
    name: string;
  } | null;
}

interface InstanceAttendanceRecord {
  id: string;
  athleteId: string;
  status: string;
  checkedIn: string | null;
}

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [attendances, setAttendances] = useState<InstanceAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState<string | null>(null);

  // Org mismatch state
  const [orgMismatch, setOrgMismatch] = useState<{
    organizationId: string;
    organizationName: string | null;
  } | null>(null);

  // Waitlist state
  const [waitlistEntries, setWaitlistEntries] = useState<
    Array<{
      id: string;
      position: number;
      athleteId: string;
      athlete: { id: string; name: string; email: string | null; avatar: string | null };
      joinedAt: string;
    }>
  >([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  useBreadcrumbOverride(
    program ? `/dashboard/registrations/programs/${programId}` : undefined,
    program?.name
  );

  useEffect(() => {
    fetchProgram();
    fetchInstances();
    fetchWaitlist();
  }, [programId]);

  useEffect(() => {
    if (selectedInstance) {
      fetchRegistrations(selectedInstance.id);
    }
  }, [selectedInstance]);

  const fetchProgram = async () => {
    try {
      const response = await fetch(`/api/programs/${programId}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.code === "ORG_MISMATCH") {
          setOrgMismatch({
            organizationId: data.organizationId,
            organizationName: data.organizationName,
          });
          return;
        }
        throw new Error("Failed to fetch program");
      }
      const data = await response.json();
      setProgram(data);
    } catch (error) {
      toast.error("Failed to load program");
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    setInstancesLoading(true);
    try {
      const response = await fetch(`/api/programs/${programId}/instances`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.code === "ORG_MISMATCH") return;
        throw new Error("Failed to fetch instances");
      }
      const data = await response.json();
      setInstances(data.instances || []);
    } catch (error) {
      toast.error("Failed to load instances");
    } finally {
      setInstancesLoading(false);
    }
  };

  const fetchRegistrations = async (instanceId: string) => {
    setRegistrationsLoading(true);
    try {
      const [regRes, attRes] = await Promise.all([
        fetch(`/api/programs/${programId}/instances/${instanceId}/registrations`),
        fetch(`/api/programs/${programId}/instances/${instanceId}/attendance`),
      ]);
      if (!regRes.ok) throw new Error("Failed to fetch registrations");
      const regData = await regRes.json();
      setRegistrations(regData || []);

      if (attRes.ok) {
        const attData = await attRes.json();
        setAttendances(attData.attendances || []);
      }
    } catch (error) {
      toast.error("Failed to load registrations");
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const fetchWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const response = await fetch(`/api/programs/${programId}/waitlist`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.code === "ORG_MISMATCH") return;
        throw new Error("Failed to fetch waitlist");
      }
      const data = await response.json();
      setWaitlistEntries(data.waitlisted || []);
    } catch (error) {
      console.error("Failed to load waitlist:", error);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const promoteFromWaitlist = async (enrollmentId: string) => {
    setPromotingId(enrollmentId);
    try {
      const response = await fetch(`/api/programs/${programId}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      if (!response.ok) throw new Error("Failed to promote");
      toast.success("Athlete promoted from waitlist");
      fetchWaitlist();
      fetchProgram();
    } catch (error) {
      toast.error("Failed to promote from waitlist");
    } finally {
      setPromotingId(null);
    }
  };

  const updateInstanceStatus = async (instanceId: string, status: string) => {
    try {
      const response = await fetch(`/api/programs/${programId}/instances/${instanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update instance");
      toast.success(`Instance ${status.toLowerCase()}`);
      fetchInstances();
    } catch (error) {
      toast.error("Failed to update instance");
    }
  };

  const updateRegistrationStatus = async (registrationId: string, status: string) => {
    if (!selectedInstance) return;
    try {
      const response = await fetch(
        `/api/programs/${programId}/instances/${selectedInstance.id}/registrations/${registrationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!response.ok) throw new Error("Failed to update registration");
      toast.success(`Registration ${status.toLowerCase()}`);
      fetchRegistrations(selectedInstance.id);
    } catch (error) {
      toast.error("Failed to update registration");
    }
  };

  const markAttendance = async (athleteId: string, status: string) => {
    if (!selectedInstance) return;
    setAttendanceLoading(athleteId);
    try {
      const response = await fetch(
        `/api/programs/${programId}/instances/${selectedInstance.id}/attendance`,
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
      fetchRegistrations(selectedInstance.id);
    } catch (error) {
      toast.error("Failed to mark attendance");
    } finally {
      setAttendanceLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orgMismatch) {
    const switchUrl = `/dashboard/switch-org?orgId=${encodeURIComponent(orgMismatch.organizationId)}&orgName=${encodeURIComponent(orgMismatch.organizationName || "")}&redirect=${encodeURIComponent(`/dashboard/registrations/programs/${programId}`)}`;
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Wrong organization</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            This program belongs to{" "}
            <span className="font-medium text-foreground">
              {orgMismatch.organizationName || "another organization"}
            </span>
            . Switch organizations to view it.
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" asChild>
              <Link href="/dashboard/registrations/programs">Back to Programs</Link>
            </Button>
            <Button asChild>
              <Link href={switchUrl}>
                Switch to {orgMismatch.organizationName || "Organization"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Program not found</h2>
          <Button asChild className="mt-4">
            <Link href="/dashboard/registrations/programs">Back to Programs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isPerInstance = program.registrationType === "PER_INSTANCE";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/registrations/programs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{program.name}</h1>
              <Badge variant={program.status === "ACTIVE" ? "default" : "secondary"}>
                {program.status}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Repeat className="h-3 w-3" />
                Recurring
              </Badge>
            </div>
            {program.description && (
              <div
                className="text-muted-foreground mt-1 [&>p]:m-0"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) }}
              />
            )}
          </div>
        </div>
        <Button asChild>
          <Link href={`/dashboard/registrations/programs/${programId}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Program
          </Link>
        </Button>
      </div>

      {/* Program Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{program._count.instances}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{program._count.enrollments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{program.capacity || "Unlimited"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const isRecurring =
                  program.billingInterval &&
                  program.billingInterval !== "ONE_TIME" &&
                  program.billingInterval !== "SESSION" &&
                  program.recurringPrice;
                const displayPrice = isRecurring
                  ? Number(program.recurringPrice)
                  : program.basePrice
                    ? Number(program.basePrice)
                    : program.perSessionPrice
                      ? Number(program.perSessionPrice)
                      : null;
                if (!displayPrice) return "Free";
                const formatted = `$${displayPrice.toFixed(0)}`;
                const suffix =
                  isRecurring && program.billingInterval === "MONTHLY"
                    ? "/mo"
                    : isRecurring && program.billingInterval === "YEARLY"
                      ? "/yr"
                      : program.pricingModel === "PER_SESSION"
                        ? "/session"
                        : "";
                return formatted + suffix;
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {program.startDate && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Dates</div>
                  <div className="text-sm text-muted-foreground">
                    {program.endDate ? (
                      <>
                        {format(new Date(program.startDate), "MMM d")} -{" "}
                        {format(new Date(program.endDate), "MMM d, yyyy")}
                      </>
                    ) : (
                      format(new Date(program.startDate), "MMMM d, yyyy")
                    )}
                  </div>
                </div>
              </div>
            )}
            {program.startTime && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Time</div>
                  <div className="text-sm text-muted-foreground">
                    {program.startTime}
                    {program.duration && ` (${program.duration} min)`}
                  </div>
                </div>
              </div>
            )}
            {program.facility && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Location</div>
                  <div className="text-sm text-muted-foreground">
                    {program.facility.name}
                    {program.facility.city && `, ${program.facility.city}`}
                  </div>
                </div>
              </div>
            )}
            {program.registrationType && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Registration Type</div>
                  <div className="text-sm text-muted-foreground">
                    {isPerInstance ? "Per Session (Drop-in)" : "Full Program"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instances and Registrations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Instances List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sessions</CardTitle>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Session
              </Button>
            </div>
            <CardDescription>{instances.length} sessions scheduled</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {instancesLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : instances.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No sessions scheduled yet</div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {instances.map((instance) => (
                  <div
                    key={instance.id}
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedInstance?.id === instance.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedInstance(instance)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[45px]">
                        <div className="text-xs font-medium text-muted-foreground">
                          {format(new Date(instance.date), "MMM")}
                        </div>
                        <div className="text-xl font-bold">
                          {format(new Date(instance.date), "d")}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {format(new Date(instance.date), "EEEE")}
                          {instance.status === "CANCELLED" && (
                            <Badge variant="destructive" className="text-xs">
                              Cancelled
                            </Badge>
                          )}
                          {instance.status === "COMPLETED" && (
                            <Badge variant="secondary" className="text-xs">
                              Completed
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {instance.startTime} - {instance.endTime}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {instance._count.registrations}
                          {instance.capacity && `/${instance.capacity}`}
                        </div>
                        <div className="text-xs text-muted-foreground">registered</div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedInstance(instance)}>
                            View Registrations
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {instance.status !== "COMPLETED" && (
                            <DropdownMenuItem
                              onClick={() => updateInstanceStatus(instance.id, "COMPLETED")}
                            >
                              Mark as Completed
                            </DropdownMenuItem>
                          )}
                          {instance.status !== "CANCELLED" && (
                            <DropdownMenuItem
                              onClick={() => updateInstanceStatus(instance.id, "CANCELLED")}
                              className="text-destructive"
                            >
                              Cancel Session
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registrations for Selected Instance */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedInstance
                ? `Registrations - ${format(new Date(selectedInstance.date), "MMM d, yyyy")}`
                : "Registrations"}
            </CardTitle>
            <CardDescription>
              {selectedInstance
                ? `${registrations.length} athletes registered`
                : "Select a session to view registrations"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedInstance ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Select a session on the left to view its registrations</p>
              </div>
            ) : registrationsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : registrations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No registrations for this session</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => {
                    const attendance = attendances.find((a) => a.athleteId === reg.athlete.id);
                    return (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={reg.athlete.avatar || undefined}
                                alt={reg.athlete.name}
                              />
                              <AvatarFallback>{reg.athlete.name?.charAt(0) || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{reg.athlete.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {reg.athlete.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{reg.user?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              reg.status === "WAITLISTED"
                                ? "secondary"
                                : reg.status === "CANCELLED"
                                  ? "outline"
                                  : "default"
                            }
                          >
                            {reg.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {reg.status === "REGISTERED" ? (
                            <Select
                              value={attendance?.status || ""}
                              onValueChange={(value) => markAttendance(reg.athlete.id, value)}
                              disabled={attendanceLoading === reg.athlete.id}
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
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
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
                                View Athlete
                              </DropdownMenuItem>
                              {reg.status !== "CANCELLED" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => updateRegistrationStatus(reg.id, "CANCELLED")}
                                    className="text-destructive"
                                  >
                                    Cancel Registration
                                  </DropdownMenuItem>
                                </>
                              )}
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
      </div>

      {/* Waitlist Section */}
      {program.waitlistEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Waitlist
                </CardTitle>
                <CardDescription>
                  {waitlistEntries.length} athlete{waitlistEntries.length !== 1 ? "s" : ""} on the
                  waitlist
                  {program.waitlistCapacity != null && ` (max ${program.waitlistCapacity})`}
                  {program.waitlistAutoPromote && " · Auto-promote enabled"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {waitlistLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : waitlistEntries.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No one is currently on the waitlist
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitlistEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.position}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={entry.athlete.avatar || ""} />
                            <AvatarFallback className="text-xs">
                              {entry.athlete.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{entry.athlete.name}</div>
                            {entry.athlete.email && (
                              <div className="text-xs text-muted-foreground">
                                {entry.athlete.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(entry.joinedAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => promoteFromWaitlist(entry.id)}
                          disabled={promotingId !== null}
                        >
                          {promotingId === entry.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          Promote
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
