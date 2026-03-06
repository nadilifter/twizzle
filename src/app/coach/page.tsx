"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  ClipboardCheck,
  Camera,
  Star,
  Trophy,
  GraduationCap,
  Clock,
  MapPin,
  Users,
  ArrowRight,
  AlertCircle,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { format } from "date-fns";

interface OverviewEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  program: { id: string; name: string } | null;
  facility: { id: string; name: string } | null;
  organization?: { id: string; name: string };
  attendanceCount: number;
}

interface OverviewProgram {
  id: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
  enrollmentCount: number;
  eventCount: number;
}

interface OverviewCompetition {
  id: string;
  name: string;
  competitionType: string;
  status: string;
  startDate: string;
  endDate: string;
  startTime: string;
  city: string;
  stateProvince: string;
  facility: { id: string; name: string } | null;
  entryCount: number;
  categoryCount: number;
}

interface CoachingOrg {
  id: string;
  name: string;
}

interface OverviewData {
  todayEvents: OverviewEvent[];
  todayEventCount: number;
  weekEventCount: number;
  pendingAttendanceCount: number;
  programs: OverviewProgram[];
  programCount: number;
  upcomingCompetitions: OverviewCompetition[];
  competitionCount: number;
  nextEvent: OverviewEvent | null;
  organizations?: CoachingOrg[];
}

const EVENT_TYPE_STYLES: Record<string, string> = {
  CLASS: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  CAMP: "bg-green-500/10 text-green-700 dark:text-green-400",
  COMPETITION: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  MEETING: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  OTHER: "bg-muted text-muted-foreground",
};

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Skeleton className="h-8 w-12 mb-1" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

export default function CoachDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOverview() {
      try {
        setIsLoading(true);
        const response = await api.get<OverviewData>("/api/coach/overview");
        setData(response);
        setError(null);
      } catch {
        setError("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Overview</h2>
        <div className="grid gap-4 grid-cols-2">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">Today</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {data?.todayEventCount ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    event{data?.todayEventCount !== 1 ? "s" : ""} today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">
                    Attendance
                  </CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div
                    className={`text-2xl font-bold ${(data?.pendingAttendanceCount ?? 0) > 0 ? "text-destructive" : ""}`}
                  >
                    {data?.pendingAttendanceCount ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    pending today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">
                    Programs
                  </CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {data?.programCount ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                  <CardTitle className="text-sm font-medium">
                    Competitions
                  </CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">
                    {data?.competitionCount ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">upcoming</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/coach/attendance">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Attendance</span>
            </Card>
          </Link>
          <Link href="/coach/evaluations">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <Star className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Evaluations</span>
            </Card>
          </Link>
          <Link href="/coach/media">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <Camera className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Media</span>
            </Card>
          </Link>
          <Link href="/coach/schedule">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <CalendarDays className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Schedule</span>
            </Card>
          </Link>
        </div>
      </div>

      {/* Today's Schedule */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Today&apos;s Schedule</h2>
          <Link
            href="/coach/schedule"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (data?.todayEvents.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No events scheduled for today
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data?.todayEvents.map((event) => (
              <Link
                key={event.id}
                href={`/coach/attendance?eventId=${event.id}`}
              >
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer mb-3">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">
                            {event.title}
                          </h3>
                          <Badge
                            variant="outline"
                            className={
                              EVENT_TYPE_STYLES[event.type] ??
                              EVENT_TYPE_STYLES.OTHER
                            }
                          >
                            {event.type}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {event.startTime} - {event.endTime}
                          </span>
                          {event.program && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5" />
                              {event.program.name}
                            </span>
                          )}
                          {event.facility && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {event.facility.name}
                            </span>
                          )}
                          {event.organization && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {event.organization.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold whitespace-nowrap ml-2">
                        {event.attendanceCount}{" "}
                        {event.attendanceCount === 1 ? "student" : "students"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Programs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">My Programs</h2>
          <Link
            href="/coach/programs"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (data?.programs.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No active programs assigned
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data?.programs.map((program) => (
              <Card key={program.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{program.name}</h3>
                      <div className="flex gap-3 text-sm text-muted-foreground mt-0.5">
                        {program.organizationName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {program.organizationName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {program.enrollmentCount} enrolled
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {program.eventCount} events
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Competitions */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Upcoming Competitions</h2>
        {isLoading ? (
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (data?.upcomingCompetitions.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No upcoming competitions
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data?.upcomingCompetitions.map((comp) => (
              <Card key={comp.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{comp.name}</h3>
                        <Badge variant="outline">{comp.competitionType}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(new Date(comp.startDate), "MMM d, yyyy")}
                          {comp.startDate !== comp.endDate &&
                            ` - ${format(new Date(comp.endDate), "MMM d, yyyy")}`}
                        </span>
                        {(comp.city || comp.facility) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {comp.facility?.name ?? comp.city}
                            {comp.stateProvince ? `, ${comp.stateProvince}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      {comp.entryCount > 0 && (
                        <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                          {comp.entryCount}{" "}
                          {comp.entryCount === 1 ? "entry" : "entries"}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* This Week Summary */}
      {!isLoading && data && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {data.weekEventCount} event
                {data.weekEventCount !== 1 ? "s" : ""} this week
              </span>
              <Link
                href="/coach/schedule"
                className="text-primary hover:underline"
              >
                View schedule
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
