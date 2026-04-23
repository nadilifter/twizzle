"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardList,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";

import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SessionDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number | null;
  notes: string | null;
  program: { id: string; name: string; registrationType: string };
  facility: {
    id: string;
    name: string;
    street: string | null;
    city: string | null;
    stateProvince: string | null;
  } | null;
  registrations: {
    id: string;
    status: string;
    athlete: { id: string; name: string | null; avatar: string | null };
    user: { id: string; name: string | null; email: string } | null;
  }[];
  attendances: {
    id: string;
    athleteId: string;
    status: string;
  }[];
  evaluations: {
    id: string;
    date: string;
    overallScore: string | number;
    status: string;
    athlete: { id: string; name: string | null; avatar: string | null };
    coach: { id: string; name: string | null } | null;
    template: { id: string; name: string } | null;
  }[];
  lessonPlans: {
    id: string;
    name: string;
    status: string;
    theme: string | null;
    notes: string | null;
    date: string | null;
  }[];
}

const ATTENDANCE_STYLE: Record<string, string> = {
  PRESENT: "bg-green-50 text-green-700 border-green-200",
  ABSENT: "bg-red-50 text-red-700 border-red-200",
  LATE: "bg-yellow-50 text-yellow-700 border-yellow-200",
  EXCUSED: "bg-blue-50 text-blue-700 border-blue-200",
  REGISTERED: "bg-muted text-muted-foreground",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function ProgramSessionDetailPage() {
  const params = useParams();
  const programId = typeof params.id === "string" ? params.id : "";
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  const [data, setData] = React.useState<SessionDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [attendanceSaving, setAttendanceSaving] = React.useState<string | null>(null);

  useBreadcrumbOverride(
    data ? `/dashboard/registrations/programs/${programId}` : undefined,
    data?.program.name
  );
  useBreadcrumbOverride(
    data ? `/dashboard/registrations/programs/${programId}/sessions/${sessionId}` : undefined,
    data ? format(new Date(data.date), "MMM d, yyyy") : undefined
  );

  const fetchSession = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/programs/${programId}/instances/${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      setData(json);
    } catch {
      toast.error("Failed to load session details");
    } finally {
      setLoading(false);
    }
  }, [programId, sessionId]);

  React.useEffect(() => {
    if (programId && sessionId) {
      setLoading(true);
      fetchSession();
    }
  }, [programId, sessionId, fetchSession]);

  const markAttendance = async (athleteId: string, status: string) => {
    setAttendanceSaving(athleteId);
    try {
      const response = await fetch(`/api/programs/${programId}/instances/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, status }),
      });
      if (!response.ok) throw new Error("Failed");
      await fetchSession();
    } catch {
      toast.error("Failed to save attendance");
    } finally {
      setAttendanceSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Session Not Found</h1>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/registrations/programs/${programId}?tab=sessions`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
      </div>
    );
  }

  const attendanceByAthlete = new Map(data.attendances.map((a) => [a.athleteId, a.status]));
  const locationLabel = data.facility
    ? [data.facility.name, data.facility.city].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/registrations/programs/${programId}?tab=sessions`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {format(new Date(data.date), "EEEE, MMM d, yyyy")}
            </h1>
            <Badge
              variant={
                data.status === "CANCELLED"
                  ? "destructive"
                  : data.status === "COMPLETED"
                    ? "secondary"
                    : "default"
              }
            >
              {data.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {data.startTime} &ndash; {data.endTime}
            </span>
            {locationLabel && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {locationLabel}
              </span>
            )}
            <span>Capacity: {data.capacity ?? "Unlimited"}</span>
          </div>
        </div>
      </div>

      {/* Registrations + Attendance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Registrations &amp; Attendance
          </CardTitle>
          <CardDescription>
            {data.registrations.length} athlete
            {data.registrations.length === 1 ? "" : "s"} registered
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.registrations.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No registrations for this session yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.registrations.map((reg) => {
                  const attStatus = attendanceByAthlete.get(reg.athlete.id) ?? "";
                  return (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={reg.athlete.avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(reg.athlete.name)}
                            </AvatarFallback>
                          </Avatar>
                          <Link
                            href={`/dashboard/registrations/programs/${programId}/athletes/${reg.athlete.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {reg.athlete.name ?? "Unknown"}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {reg.user ? (
                          <div>
                            <p className="font-medium">{reg.user.name ?? "-"}</p>
                            <p className="text-xs text-muted-foreground">{reg.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{reg.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {reg.status === "REGISTERED" ? (
                          <Select
                            value={attStatus || undefined}
                            onValueChange={(v) => markAttendance(reg.athlete.id, v)}
                            disabled={attendanceSaving === reg.athlete.id}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue placeholder="Mark..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PRESENT">Present</SelectItem>
                              <SelectItem value="ABSENT">Absent</SelectItem>
                              <SelectItem value="LATE">Late</SelectItem>
                              <SelectItem value="EXCUSED">Excused</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : attStatus ? (
                          <Badge variant="outline" className={cn(ATTENDANCE_STYLE[attStatus])}>
                            {attStatus}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lesson Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Lesson Plan
          </CardTitle>
          <CardDescription>
            {data.lessonPlans.length > 0
              ? `${data.lessonPlans.length} plan${data.lessonPlans.length === 1 ? "" : "s"} for this date`
              : "No lesson plan scheduled for this date"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.lessonPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lesson plan linked to this session.</p>
          ) : (
            <div className="space-y-4">
              {data.lessonPlans.map((lp) => (
                <div key={lp.id} className="border rounded-md p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{lp.name}</p>
                      {lp.theme && (
                        <p className="text-xs text-muted-foreground mt-0.5">Theme: {lp.theme}</p>
                      )}
                    </div>
                    <Badge variant="outline">{lp.status}</Badge>
                  </div>
                  {lp.notes && <p className="text-sm mt-2 whitespace-pre-wrap">{lp.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evaluations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Evaluations
          </CardTitle>
          <CardDescription>
            {data.evaluations.length} evaluation{data.evaluations.length === 1 ? "" : "s"} recorded
            in this session
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.evaluations.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No evaluations recorded in this session.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.evaluations.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/registrations/programs/${programId}/athletes/${e.athlete.id}`}
                        className="text-primary hover:underline"
                      >
                        {e.athlete.name ?? "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell>{e.template?.name ?? "-"}</TableCell>
                    <TableCell>{e.coach?.name ?? "-"}</TableCell>
                    <TableCell>{String(e.overallScore)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.status}</Badge>
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
