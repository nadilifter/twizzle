"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BentoGrid, BentoTile } from "@/components/ui/bento";
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
import { formatTime12h } from "@/lib/date-utils";
import { CountUp } from "@/components/ui/count-up";

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
  CLINIC: "bg-green-500/10 text-green-700 dark:text-green-400",
  TRYOUT: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  MEETING: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  OTHER: "bg-muted text-muted-foreground",
};

function StatTileSkeleton() {
  return (
    <BentoTile flat className="p-4">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-3 h-8 w-12" />
      <Skeleton className="mt-2 h-3 w-16" />
    </BentoTile>
  );
}

function HeroTileSkeleton() {
  return (
    <BentoTile flat colSpan={2} rowSpan={2} className="p-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-4 h-12 w-20" />
      <Skeleton className="mt-3 h-4 w-40" />
    </BentoTile>
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
      {/* Overview — bento grid: hero "Today" tile + 4 KPI tiles */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Overview</h2>
        <BentoGrid cols={4}>
          {isLoading ? (
            <>
              <HeroTileSkeleton />
              <StatTileSkeleton />
              <StatTileSkeleton />
              <StatTileSkeleton />
              <StatTileSkeleton />
            </>
          ) : (
            <>
              <BentoTile asChild colSpan={2} rowSpan={2}>
                <Link
                  href="/coach/schedule"
                  className="flex flex-col justify-between p-6 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Today</p>
                      <p className="mt-2 text-5xl font-bold tracking-tight">
                        <CountUp value={data?.todayEventCount ?? 0} />
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        event{data?.todayEventCount !== 1 ? "s" : ""} on the schedule
                      </p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-primary group-hover:underline">
                    View today&apos;s schedule <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              </BentoTile>

              <BentoTile asChild>
                <Link
                  href="/coach/attendance"
                  className="flex flex-col justify-between p-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Attendance</span>
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p
                      className={`text-2xl font-bold ${(data?.pendingAttendanceCount ?? 0) > 0 ? "text-destructive" : ""}`}
                    >
                      <CountUp value={data?.pendingAttendanceCount ?? 0} />
                    </p>
                    <p className="text-xs text-muted-foreground">pending today</p>
                  </div>
                </Link>
              </BentoTile>

              <BentoTile asChild>
                <Link
                  href="/coach/programs"
                  className="flex flex-col justify-between p-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Programs</span>
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      <CountUp value={data?.programCount ?? 0} />
                    </p>
                    <p className="text-xs text-muted-foreground">active</p>
                  </div>
                </Link>
              </BentoTile>

              <BentoTile flat className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Competitions</span>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    <CountUp value={data?.competitionCount ?? 0} />
                  </p>
                  <p className="text-xs text-muted-foreground">upcoming</p>
                </div>
              </BentoTile>

              <BentoTile asChild>
                <Link
                  href="/coach/schedule"
                  className="flex flex-col justify-between p-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">This week</span>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      <CountUp value={data?.weekEventCount ?? 0} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      event{data?.weekEventCount !== 1 ? "s" : ""} scheduled
                    </p>
                  </div>
                </Link>
              </BentoTile>
            </>
          )}
        </BentoGrid>
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
              <p className="text-sm text-muted-foreground">No events scheduled for today</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data?.todayEvents.map((event) => (
              <Link key={event.id} href={`/coach/attendance?eventId=${event.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer mb-3">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{event.title}</h3>
                          <Badge
                            variant="outline"
                            className={EVENT_TYPE_STYLES[event.type] ?? EVENT_TYPE_STYLES.OTHER}
                          >
                            {event.type}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime12h(event.startTime)} - {formatTime12h(event.endTime)}
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
              <p className="text-sm text-muted-foreground">No active programs assigned</p>
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
              <p className="text-sm text-muted-foreground">No upcoming competitions</p>
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
                          {comp.entryCount} {comp.entryCount === 1 ? "entry" : "entries"}
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
    </div>
  );
}
