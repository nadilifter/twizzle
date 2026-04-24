"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { BarChart3, Users, Calendar } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AthleteSummary {
  athleteId: string;
  name: string | null;
  avatar: string | null;
  present: number;
  absent: number;
  late: number;
  excused: number;
  registered: number;
  total: number;
  percentage: number;
}

interface SessionSummary {
  instanceId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  registered: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

interface AttendanceTabProps {
  programId: string;
}

function percentColor(pct: number): string {
  if (pct >= 90) return "bg-green-50 text-green-700 border-green-200";
  if (pct >= 70) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (pct > 0) return "bg-red-50 text-red-700 border-red-200";
  return "bg-muted text-muted-foreground";
}

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

export function AttendanceTab({ programId }: AttendanceTabProps) {
  const [view, setView] = React.useState<"athlete" | "session">("athlete");
  const [athleteRows, setAthleteRows] = React.useState<AthleteSummary[]>([]);
  const [sessionRows, setSessionRows] = React.useState<SessionSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/programs/${programId}/attendance-summary?view=${view}`);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        if (view === "athlete") setAthleteRows(json.rows ?? []);
        else setSessionRows(json.rows ?? []);
      } catch {
        toast.error("Failed to load attendance");
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [programId, view]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Attendance</CardTitle>
            <CardDescription className="mt-1">
              {view === "athlete"
                ? "Attendance rollup per athlete across all sessions"
                : "Attendance rollup per session"}
            </CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "athlete" | "session")}>
            <ResponsiveTabsList
              value={view}
              onValueChange={(v) => setView(v as "athlete" | "session")}
            >
              <TabsTrigger value="athlete" className="gap-2">
                <Users className="h-4 w-4" />
                By Athlete
              </TabsTrigger>
              <TabsTrigger value="session" className="gap-2">
                <Calendar className="h-4 w-4" />
                By Session
              </TabsTrigger>
            </ResponsiveTabsList>
            <TabsContent value="athlete" className="hidden" />
            <TabsContent value="session" className="hidden" />
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : view === "athlete" ? (
          athleteRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Absent</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">Excused</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athleteRows.map((r) => (
                    <TableRow key={r.athleteId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.avatar || undefined} alt={r.name ?? ""} />
                            <AvatarFallback className="text-xs">
                              {getInitials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                          <Link
                            href={`/dashboard/registrations/programs/${programId}/athletes/${r.athleteId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {r.name ?? "Unknown athlete"}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.present}</TableCell>
                      <TableCell className="text-right">{r.absent}</TableCell>
                      <TableCell className="text-right">{r.late}</TableCell>
                      <TableCell className="text-right">{r.excused}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.total}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={percentColor(r.percentage)}>
                          {r.percentage}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : sessionRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                  <TableHead className="text-right">Late</TableHead>
                  <TableHead className="text-right">Excused</TableHead>
                  <TableHead className="text-right">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionRows.map((r) => (
                  <TableRow key={r.instanceId}>
                    <TableCell>
                      <Link
                        href={`/dashboard/registrations/programs/${programId}/sessions/${r.instanceId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {format(new Date(r.date), "EEE, MMM d, yyyy")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.startTime} &ndash; {r.endTime}
                    </TableCell>
                    <TableCell className="text-right">{r.present}</TableCell>
                    <TableCell className="text-right">{r.absent}</TableCell>
                    <TableCell className="text-right">{r.late}</TableCell>
                    <TableCell className="text-right">{r.excused}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.registered}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
