"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isWithinInterval,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Users,
  Loader2,
  Filter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  startTime: string;
  endTime: string;
  status: string;
  programId: string;
  programName: string;
  facilityId: string | null;
  facilityName: string | null;
  capacity: number | null;
  registrationCount: number;
  attendanceCount: number;
  color: string;
  levelName: string | null;
  recurrenceType: string | null;
  registrationType: string | null;
}

interface Facility {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
}

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>("");
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [facilitiesRes, programsRes] = await Promise.all([
          fetch("/api/organization/facilities"),
          fetch("/api/programs?limit=100"),
        ]);

        if (facilitiesRes.ok) {
          const data = await facilitiesRes.json();
          setFacilities(data.facilities || []);
        }
        if (programsRes.ok) {
          const data = await programsRes.json();
          setPrograms(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch filters:", error);
      }
    };
    fetchFilters();
  }, []);

  // Fetch events when date range or filters change
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let start: Date, end: Date;

      if (viewMode === "month") {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        start = startOfWeek(monthStart, { weekStartsOn: 0 });
        end = endOfWeek(monthEnd, { weekStartsOn: 0 });
      } else if (viewMode === "week") {
        start = startOfWeek(currentDate, { weekStartsOn: 0 });
        end = endOfWeek(currentDate, { weekStartsOn: 0 });
      } else {
        start = currentDate;
        end = currentDate;
      }

      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (selectedFacility) params.append("facilityId", selectedFacility);
      if (selectedProgram) params.append("programId", selectedProgram);
      if (selectedStatus) params.append("status", selectedStatus);

      const response = await fetch(`/api/calendar/instances?${params}`);

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, selectedFacility, selectedProgram, selectedStatus]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const navigatePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventClick = (event: CalendarEvent) => {
    router.push(`/dashboard/calendar/instance/${event.id}`);
  };

  const clearFilters = () => {
    setSelectedFacility("");
    setSelectedProgram("");
    setSelectedStatus("");
  };

  const hasActiveFilters = selectedFacility || selectedProgram || selectedStatus;

  // Generate calendar days for month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
  }, [currentDate]);

  // Generate week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({
      start,
      end: addDays(start, 6),
    });
  }, [currentDate]);

  // Filter events visible in current range
  const visibleEvents = useMemo(() => {
    const calendarStart =
      viewMode === "month"
        ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
        : viewMode === "week"
        ? startOfWeek(currentDate, { weekStartsOn: 0 })
        : currentDate;

    const calendarEnd =
      viewMode === "month"
        ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
        : viewMode === "week"
        ? endOfWeek(currentDate, { weekStartsOn: 0 })
        : currentDate;

    return events.filter((event) => {
      try {
        const eventDate = parseISO(event.start);
        return isWithinInterval(eventDate, {
          start: calendarStart,
          end: calendarEnd,
        });
      } catch {
        return false;
      }
    });
  }, [events, currentDate, viewMode]);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return visibleEvents
      .filter((event) => {
        try {
          return isSameDay(parseISO(event.start), day);
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const renderEvent = (event: CalendarEvent, compact = false) => {
    const isCancelled = event.status === "CANCELLED";

    return (
      <button
        key={event.id}
        onClick={(e) => {
          e.stopPropagation();
          handleEventClick(event);
        }}
        className={cn(
          "w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          isCancelled && "opacity-50 line-through"
        )}
        style={{
          backgroundColor: `${event.color}20`,
          color: event.color,
          borderLeft: `3px solid ${event.color}`,
        }}
      >
        {compact ? event.startTime : `${event.startTime} ${event.title}`}
      </button>
    );
  };

  const renderEventCard = (event: CalendarEvent) => {
    const isCancelled = event.status === "CANCELLED";

    return (
      <div
        key={event.id}
        onClick={() => handleEventClick(event)}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
          isCancelled && "opacity-50"
        )}
        style={{ borderLeftColor: event.color, borderLeftWidth: 4 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn("font-medium truncate", isCancelled && "line-through")}
            >
              {event.title}
            </span>
            {event.levelName && (
              <Badge
                variant="outline"
                className="text-xs shrink-0"
                style={{ color: event.color, borderColor: event.color }}
              >
                {event.levelName}
              </Badge>
            )}
            {event.status !== "SCHEDULED" && (
              <Badge
                variant={event.status === "COMPLETED" ? "secondary" : "destructive"}
                className="text-xs shrink-0"
              >
                {event.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {event.startTime} - {event.endTime}
            </span>
            {event.facilityName && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.facilityName}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 shrink-0" />
              {event.registrationCount}
              {event.capacity && `/${event.capacity}`}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 md:h-6 md:w-6" />
          Program Schedule
        </h1>
        <div className="flex items-center gap-2">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {[selectedFacility, selectedProgram, selectedStatus].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Events</SheetTitle>
                <SheetDescription>
                  Narrow down the calendar to specific programs, facilities, or statuses
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Program</label>
                  <Select
                    value={selectedProgram || "__all__"}
                    onValueChange={(v) => setSelectedProgram(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All programs</SelectItem>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Facility</label>
                  <Select
                    value={selectedFacility || "__all__"}
                    onValueChange={(v) => setSelectedFacility(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All facilities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All facilities</SelectItem>
                      {facilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.id}>
                          {facility.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={selectedStatus || "__all__"}
                    onValueChange={(v) => setSelectedStatus(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All statuses</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="w-full gap-2">
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Calendar Card */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 border-b shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={navigatePrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:px-3"
                  onClick={goToToday}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={navigateNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-sm sm:text-lg font-medium">
                {viewMode === "day"
                  ? format(currentDate, "EEE, MMM d, yyyy")
                  : viewMode === "week"
                  ? `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d, yyyy")}`
                  : format(currentDate, "MMMM yyyy")}
              </CardTitle>
            </div>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[90px] sm:w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="day">Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          {/* Month View */}
          {viewMode === "month" && (
            <div className="flex flex-col h-full">
              {/* Desktop Day Headers */}
              <div className="hidden md:grid grid-cols-7 border-b divide-x divide-border bg-muted/50">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Desktop Calendar Grid */}
              <div className="hidden md:grid grid-cols-7 flex-1 divide-x divide-border overflow-auto">
                {calendarDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[100px] border-b p-1 cursor-pointer hover:bg-muted/30 transition-colors",
                        !isCurrentMonth && "bg-muted/20"
                      )}
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode("day");
                      }}
                    >
                      <div
                        className={cn(
                          "text-sm w-6 h-6 flex items-center justify-center rounded-full mb-1",
                          isTodayDate && "bg-primary text-primary-foreground font-bold",
                          !isCurrentMonth && "text-muted-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => renderEvent(event, true))}
                        {dayEvents.length > 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentDate(day);
                              setViewMode("day");
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground w-full text-left px-1.5"
                          >
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile List View */}
              <ScrollArea className="md:hidden flex-1">
                <div className="p-3 space-y-4">
                  {calendarDays
                    .filter((day) => {
                      const dayEvents = getEventsForDay(day);
                      return dayEvents.length > 0 && isSameMonth(day, currentDate);
                    })
                    .map((day) => {
                      const dayEvents = getEventsForDay(day);
                      const isTodayDate = isToday(day);

                      return (
                        <div key={day.toISOString()}>
                          <div
                            className={cn(
                              "text-sm font-medium mb-2 flex items-center gap-2",
                              isTodayDate && "text-primary"
                            )}
                          >
                            <span
                              className={cn(
                                "w-7 h-7 flex items-center justify-center rounded-full",
                                isTodayDate && "bg-primary text-primary-foreground"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            <span>{format(day, "EEEE")}</span>
                          </div>
                          <div className="space-y-2 pl-9">
                            {dayEvents.map((event) => renderEventCard(event))}
                          </div>
                        </div>
                      );
                    })}
                  {calendarDays.filter((day) => {
                    const dayEvents = getEventsForDay(day);
                    return dayEvents.length > 0 && isSameMonth(day, currentDate);
                  }).length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No sessions this month</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="flex flex-col h-full">
              {/* Desktop Week Headers */}
              <div className="hidden md:grid grid-cols-7 border-b divide-x divide-border bg-muted/50">
                {weekDays.map((day) => {
                  const isTodayDate = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "px-2 py-2 text-center",
                        isTodayDate && "bg-primary/10"
                      )}
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {format(day, "EEE")}
                      </div>
                      <div
                        className={cn(
                          "text-lg",
                          isTodayDate && "font-bold text-primary"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Week Grid */}
              <div className="hidden md:grid grid-cols-7 flex-1 divide-x divide-border overflow-auto">
                {weekDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 space-y-1",
                        isTodayDate && "bg-primary/5"
                      )}
                    >
                      {dayEvents.map((event) => renderEvent(event))}
                      {dayEvents.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          No sessions
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile Week List */}
              <ScrollArea className="md:hidden flex-1">
                <div className="p-3 space-y-4">
                  {weekDays.map((day) => {
                    const dayEvents = getEventsForDay(day);
                    const isTodayDate = isToday(day);

                    return (
                      <div key={day.toISOString()}>
                        <div
                          className={cn(
                            "text-sm font-medium mb-2 flex items-center gap-2",
                            isTodayDate && "text-primary"
                          )}
                        >
                          <span
                            className={cn(
                              "w-7 h-7 flex items-center justify-center rounded-full",
                              isTodayDate && "bg-primary text-primary-foreground"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          <span>{format(day, "EEEE")}</span>
                        </div>
                        <div className="space-y-2 pl-9">
                          {dayEvents.length > 0 ? (
                            dayEvents.map((event) => renderEventCard(event))
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No sessions
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Day View */}
          {viewMode === "day" && (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {getEventsForDay(currentDate).length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No sessions scheduled for this day</p>
                  </div>
                ) : (
                  getEventsForDay(currentDate).map((event) => renderEventCard(event))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
