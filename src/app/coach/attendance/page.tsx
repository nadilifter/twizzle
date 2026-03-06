"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useCoachEvents } from "@/hooks/use-coach-events";
import { useAttendance } from "@/hooks/use-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Check,
  X,
  Clock,
  Users,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  CalendarIcon,
  Shield,
  GraduationCap,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { format, subDays, addDays, isToday, isBefore, startOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EventWithRelations } from "@/types/events";

type AttendanceStatus = "REGISTERED" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface EnrolledAthlete {
  id: string;
  name: string;
  avatar: string | null;
  level: string;
}

const EVENT_TYPE_STYLES: Record<string, string> = {
  CLASS: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  CAMP: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  COMPETITION: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  MEETING: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  OTHER: "bg-muted text-muted-foreground",
};

export default function CoachAttendancePage() {
  return <CoachAttendanceContent />;
}

function CoachAttendanceContent() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId");

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: addDays(new Date(), 7),
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [enrolledAthletes, setEnrolledAthletes] = useState<EnrolledAthlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const { events, isLoading: loadingEvents, fetchEvents } = useCoachEvents({
    autoFetch: false,
  });
  const {
    attendances,
    isLoading: loadingAttendance,
    isUpdating,
    markAttendance,
    fetchAttendance,
  } = useAttendance();

  // Fetch events when date range changes
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      fetchEvents({
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      });
    }
  }, [dateRange, fetchEvents]);

  // Fetch attendance when event is selected
  useEffect(() => {
    if (selectedEventId) {
      fetchAttendance({ eventId: selectedEventId });
    }
  }, [selectedEventId, fetchAttendance]);

  // Fetch enrolled athletes when event selection changes
  useEffect(() => {
    if (selectedEventId) {
      fetchEnrolledAthletes(selectedEventId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, events]);

  // Auto-select initial event from URL or clear if events change
  useEffect(() => {
    if (selectedEventId && !events.find((e) => e.id === selectedEventId) && events.length > 0 && !initialEventId) {
      setSelectedEventId(null);
    }
  }, [events, selectedEventId, initialEventId]);

  const fetchEnrolledAthletes = async (eventId: string) => {
    setLoadingAthletes(true);
    try {
      const event = events.find((e) => e.id === eventId);
      if (event?.program?.id) {
        const response = await api.get<{ data: any[] }>("/api/enrollments", {
          programId: event.program.id,
          status: "ACTIVE",
        });
        setEnrolledAthletes(
          response.data.map((enrollment: any) => ({
            id: enrollment.athlete.id,
            name: enrollment.athlete.name,
            avatar: enrollment.athlete.avatar,
            level: enrollment.athlete.level,
          }))
        );
      } else {
        setEnrolledAthletes([]);
      }
    } catch (error) {
      console.error("Error fetching enrolled athletes:", error);
      setEnrolledAthletes([]);
    } finally {
      setLoadingAthletes(false);
    }
  };

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventWithRelations[]> = {};
    events.forEach((event) => {
      const dateKey = format(new Date(event.date), "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    Object.values(grouped).forEach((dayEvents) => {
      dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return grouped;
  }, [events]);

  const sortedDates = useMemo(() => {
    return Object.keys(eventsByDate).sort();
  }, [eventsByDate]);

  const getAttendanceForAthlete = (athleteId: string) => {
    return attendances.find((a) => a.athleteId === athleteId);
  };

  const handleMarkAttendance = async (athleteId: string, status: AttendanceStatus) => {
    if (!selectedEventId) return;
    await markAttendance({
      athleteId,
      eventId: selectedEventId,
      status,
    });
  };

  const handleBulkMark = useCallback(
    async (status: AttendanceStatus) => {
      if (!selectedEventId || enrolledAthletes.length === 0) return;
      setBulkUpdating(true);
      try {
        await Promise.all(
          enrolledAthletes.map((athlete) =>
            markAttendance({
              athleteId: athlete.id,
              eventId: selectedEventId,
              status,
            })
          )
        );
        toast.success(`Marked all athletes as ${status.toLowerCase()}`);
      } catch (error) {
        console.error("Error bulk marking attendance:", error);
        toast.error("Failed to mark all athletes");
      } finally {
        setBulkUpdating(false);
      }
    },
    [selectedEventId, enrolledAthletes, markAttendance]
  );

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId);
  }, [events, selectedEventId]);

  const stats = useMemo(() => {
    const present = attendances.filter((a) => a.status === "PRESENT").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    const late = attendances.filter((a) => a.status === "LATE").length;
    const excused = attendances.filter((a) => a.status === "EXCUSED").length;
    const total = enrolledAthletes.length;
    const unmarked = total - present - absent - late - excused;
    return { present, absent, late, excused, total, unmarked };
  }, [attendances, enrolledAthletes]);

  const getStatusBadge = (status?: AttendanceStatus) => {
    switch (status) {
      case "PRESENT":
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200">Present</Badge>;
      case "ABSENT":
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200">Absent</Badge>;
      case "LATE":
        return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200">Late</Badge>;
      case "EXCUSED":
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200">Excused</Badge>;
      case "REGISTERED":
        return <Badge variant="outline">Registered</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not marked</Badge>;
    }
  };

  const isLoading = loadingEvents || loadingAttendance || loadingAthletes;

  // If an event is selected, show the attendance marking view
  if (selectedEventId && selectedEvent) {
    return (
      <div className="space-y-4">
        {/* Header with back button */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedEventId(null);
              setEnrolledAthletes([]);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedEvent.title}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(selectedEvent.date), "EEEE, MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {selectedEvent.startTime} - {selectedEvent.endTime}
              </span>
              {selectedEvent.program && (
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {selectedEvent.program.name}
                </span>
              )}
              {selectedEvent.organization && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {selectedEvent.organization.name}
                </span>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className={EVENT_TYPE_STYLES[selectedEvent.type] ?? EVENT_TYPE_STYLES.OTHER}
          >
            {selectedEvent.type}
          </Badge>
        </div>

        {/* Stats */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.present}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.absent}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.late}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.excused}</p>
                  <p className="text-xs text-muted-foreground">Excused</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.unmarked}</p>
                  <p className="text-xs text-muted-foreground">Unmarked</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Athletes ({enrolledAthletes.length})</CardTitle>
              {enrolledAthletes.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={bulkUpdating || isUpdating}>
                      Bulk Actions
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkMark("PRESENT")}>
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      Mark All Present
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkMark("ABSENT")}>
                      <X className="mr-2 h-4 w-4 text-red-600" />
                      Mark All Absent
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkMark("LATE")}>
                      <Clock className="mr-2 h-4 w-4 text-yellow-600" />
                      Mark All Late
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkMark("EXCUSED")}>
                      <Shield className="mr-2 h-4 w-4 text-blue-600" />
                      Mark All Excused
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : enrolledAthletes.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No athletes enrolled in this class
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledAthletes.map((athlete) => {
                    const attendance = getAttendanceForAthlete(athlete.id);
                    const currentStatus = attendance?.status;

                    return (
                      <TableRow key={athlete.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={athlete.avatar || undefined} />
                              <AvatarFallback>
                                {athlete.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{athlete.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{athlete.level}</Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(currentStatus as AttendanceStatus | undefined)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant={currentStatus === "PRESENT" ? "default" : "outline"}
                              className={currentStatus === "PRESENT" ? "bg-green-600 hover:bg-green-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "PRESENT")}
                              disabled={isUpdating || bulkUpdating}
                              title="Present"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant={currentStatus === "LATE" ? "default" : "outline"}
                              className={currentStatus === "LATE" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "LATE")}
                              disabled={isUpdating || bulkUpdating}
                              title="Late"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant={currentStatus === "ABSENT" ? "default" : "outline"}
                              className={currentStatus === "ABSENT" ? "bg-red-600 hover:bg-red-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "ABSENT")}
                              disabled={isUpdating || bulkUpdating}
                              title="Absent"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant={currentStatus === "EXCUSED" ? "default" : "outline"}
                              className={currentStatus === "EXCUSED" ? "bg-blue-600 hover:bg-blue-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "EXCUSED")}
                              disabled={isUpdating || bulkUpdating}
                              title="Excused"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
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
      </div>
    );
  }

  // Event list view (default)
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Select a class to mark attendance</p>
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "MMM d")} -{" "}
                    {format(dateRange.to, "MMM d, yyyy")}
                  </>
                ) : (
                  format(dateRange.from, "MMM d, yyyy")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
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

      {/* Events List */}
      {loadingEvents ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Classes Found</h3>
            <p className="text-muted-foreground">
              You don&apos;t have any classes assigned in this date range. Try
              adjusting the dates or check your schedule.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dayEvents = eventsByDate[dateKey];
            const date = new Date(dateKey + "T00:00:00");
            const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
            const today = isToday(date);

            return (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-2">
                  <h3
                    className={cn(
                      "text-sm font-semibold uppercase tracking-wider",
                      today
                        ? "text-primary"
                        : isPast
                          ? "text-muted-foreground"
                          : ""
                    )}
                  >
                    {today
                      ? "Today"
                      : format(date, "EEEE, MMM d")}
                  </h3>
                  {today && (
                    <span className="text-xs text-muted-foreground">
                      {format(date, "MMM d")}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {dayEvents.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const hasAttendance = (event.attendanceCount ?? 0) > 0;

                    return (
                      <Card
                        key={event.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold truncate">
                                  {event.title}
                                </h4>
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
                                {event.organization && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3.5 w-3.5" />
                                    {event.organization.name}
                                  </span>
                                )}
                                {(event.attendanceCount ?? 0) > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {event.attendanceCount} marked
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isPast && !hasAttendance && (
                                <Badge variant="destructive" className="text-xs">
                                  Needs Attendance
                                </Badge>
                              )}
                              {hasAttendance && (
                                <Badge
                                  variant="outline"
                                  className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 text-xs"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Recorded
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {!loadingEvents && events.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              {events.length} class{events.length !== 1 ? "es" : ""} in selected
              range
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
