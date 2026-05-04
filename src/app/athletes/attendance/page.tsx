"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarIcon,
  Check,
  X,
  Clock,
  Shield,
  AlertCircle,
  Loader2,
  CalendarDays,
  User,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { formatTime12h } from "@/lib/date-utils";
import { athleteDisplayName } from "@/lib/athlete-name";
import type { AttendanceWithRelations, AttendanceStatus } from "@/types/attendance";

interface Athlete {
  id: string;
  name: string;
  level: string;
  avatar?: string | null;
  enrollments?: Array<{
    program: {
      id: string;
      name: string;
    };
  }>;
}

const statusConfig: Record<
  AttendanceStatus,
  { color: string; bgColor: string; icon: React.ReactNode; label: string }
> = {
  REGISTERED: {
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: <AlertCircle className="h-3 w-3" />,
    label: "Registered",
  },
  PRESENT: {
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: <Check className="h-3 w-3" />,
    label: "Present",
  },
  ABSENT: {
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: <X className="h-3 w-3" />,
    label: "Absent",
  },
  LATE: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: <Clock className="h-3 w-3" />,
    label: "Late",
  },
  EXCUSED: {
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: <Shield className="h-3 w-3" />,
    label: "Excused",
  },
};

export default function AthleteAttendancePage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [attendances, setAttendances] = useState<AttendanceWithRelations[]>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [activeView, setActiveView] = useState<"list" | "calendar">("list");

  useEffect(() => {
    async function fetchAthleteData() {
      setIsLoading(true);
      try {
        const response = await api.get<{ athletes: any[] }>("/api/athletes/me");
        const athleteList = response.athletes || [];
        if (athleteList.length > 0) {
          const fetched: Athlete[] = athleteList.map((athlete: any) => ({
            id: athlete.id,
            name: athleteDisplayName(athlete),
            level: athlete.level,
            avatar: athlete.avatar,
            enrollments: athlete.enrollments,
          }));

          setAthletes(fetched);
          setSelectedAthleteId(fetched[0].id);

          const programSet = new Map<string, { id: string; name: string }>();
          fetched.forEach((athlete) => {
            athlete.enrollments?.forEach((enrollment) => {
              if (enrollment.program && !programSet.has(enrollment.program.id)) {
                programSet.set(enrollment.program.id, enrollment.program);
              }
            });
          });
          setPrograms(Array.from(programSet.values()));
        }
      } catch (error) {
        console.error("Error fetching athlete data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAthleteData();
  }, []);

  // Fetch attendance when athlete or date range changes
  useEffect(() => {
    async function fetchAttendance() {
      if (!selectedAthleteId) return;

      setIsLoadingAttendance(true);
      try {
        const params: Record<string, string> = {
          athleteId: selectedAthleteId,
        };

        if (dateRange?.from) {
          params.startDate = format(dateRange.from, "yyyy-MM-dd");
        }
        if (dateRange?.to) {
          params.endDate = format(dateRange.to, "yyyy-MM-dd");
        }

        const response = await api.get<{ data: AttendanceWithRelations[] }>(
          "/api/attendance",
          params
        );
        setAttendances(response.data);
      } catch (error) {
        console.error("Error fetching attendance:", error);
        setAttendances([]);
      } finally {
        setIsLoadingAttendance(false);
      }
    }

    fetchAttendance();
  }, [selectedAthleteId, dateRange]);

  // Filter attendances by program
  const filteredAttendances = useMemo(() => {
    if (selectedProgramId === "all") return attendances;
    return attendances.filter((a) => a.event.program?.id === selectedProgramId);
  }, [attendances, selectedProgramId]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredAttendances.length;
    const present = filteredAttendances.filter((a) => a.status === "PRESENT").length;
    const absent = filteredAttendances.filter((a) => a.status === "ABSENT").length;
    const late = filteredAttendances.filter((a) => a.status === "LATE").length;
    const excused = filteredAttendances.filter((a) => a.status === "EXCUSED").length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, absent, late, excused, rate };
  }, [filteredAttendances]);

  // Get selected athlete
  const selectedAthlete = useMemo(() => {
    return athletes.find((a) => a.id === selectedAthleteId);
  }, [athletes, selectedAthleteId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Athletes Found</h3>
          <p className="text-muted-foreground">
            There are no athletes linked to your account. Please contact your organization
            administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Attendance</h1>
        <p className="text-muted-foreground">View attendance records for your athletes</p>
      </div>

      {/* Athlete Selector */}
      {athletes.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {athletes.map((athlete) => (
            <button
              key={athlete.id}
              onClick={() => setSelectedAthleteId(athlete.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors min-w-fit",
                selectedAthleteId === athlete.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={athlete.avatar || undefined} alt={athlete.name} />
                <AvatarFallback>{athlete.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="font-medium">{athlete.name}</div>
                <div
                  className={cn(
                    "text-xs",
                    selectedAthleteId === athlete.id
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {athlete.level}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.rate}%</div>
            <div className="text-xs text-muted-foreground">Attendance Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <div className="text-xs text-muted-foreground">Present</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            <div className="text-xs text-muted-foreground">Absent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
            <div className="text-xs text-muted-foreground">Late</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.excused}</div>
            <div className="text-xs text-muted-foreground">Excused</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Program</label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, y")}
                        </>
                      ) : (
                        format(dateRange.from, "MMM d, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "list" | "calendar")}>
        <ResponsiveTabsList
          value={activeView}
          onValueChange={(v) => setActiveView(v as "list" | "calendar")}
          className="grid w-full max-w-[400px] grid-cols-2"
        >
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </ResponsiveTabsList>

        {/* List View */}
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendance Records</CardTitle>
              <CardDescription>{filteredAttendances.length} records found</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAttendance ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAttendances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records found for the selected period.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {filteredAttendances
                      .sort(
                        (a, b) =>
                          new Date(b.event.date).getTime() - new Date(a.event.date).getTime()
                      )
                      .map((attendance) => {
                        const config = statusConfig[attendance.status];
                        return (
                          <div
                            key={attendance.id}
                            className="flex items-center gap-4 p-3 rounded-lg border bg-background"
                          >
                            <div className={cn("p-2 rounded-full", config.bgColor, config.color)}>
                              {config.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{attendance.event.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {format(parseISO(attendance.event.date), "EEEE, MMMM d, yyyy")}
                                <span className="mx-1">•</span>
                                {formatTime12h(attendance.event.startTime)} -{" "}
                                {formatTime12h(attendance.event.endTime)}
                              </div>
                              {attendance.event.program && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {attendance.event.program.name}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(config.bgColor, config.color, "border-0")}
                            >
                              {config.label}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Calendar</CardTitle>
              <CardDescription>Select a date range to view attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  className="rounded-md border p-3"
                />
                <div className="flex-1">
                  <h4 className="font-medium mb-3">Attendance Summary</h4>
                  <div className="space-y-3">
                    {filteredAttendances.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No records in selected range</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(
                            filteredAttendances.reduce(
                              (acc, a) => {
                                const dateKey = format(parseISO(a.event.date), "MMM d");
                                if (!acc[dateKey])
                                  acc[dateKey] = { present: 0, absent: 0, late: 0, excused: 0 };
                                if (a.status === "PRESENT") acc[dateKey].present++;
                                else if (a.status === "ABSENT") acc[dateKey].absent++;
                                else if (a.status === "LATE") acc[dateKey].late++;
                                else if (a.status === "EXCUSED") acc[dateKey].excused++;
                                return acc;
                              },
                              {} as Record<
                                string,
                                { present: number; absent: number; late: number; excused: number }
                              >
                            )
                          )
                            .slice(0, 6)
                            .map(([date, counts]) => (
                              <div key={date} className="p-2 rounded-lg border bg-background">
                                <div className="font-medium text-sm">{date}</div>
                                <div className="flex gap-2 mt-1">
                                  {counts.present > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-green-50 text-green-700 text-xs"
                                    >
                                      {counts.present} present
                                    </Badge>
                                  )}
                                  {counts.absent > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-red-50 text-red-700 text-xs"
                                    >
                                      {counts.absent} absent
                                    </Badge>
                                  )}
                                  {counts.late > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-yellow-50 text-yellow-700 text-xs"
                                    >
                                      {counts.late} late
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Excused</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
