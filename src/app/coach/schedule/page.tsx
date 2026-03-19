"use client";

import { useState, useMemo } from "react";
import { useCoachEvents } from "@/hooks/use-coach-events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  List,
  CalendarIcon,
  ClipboardCheck,
  Building2,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import Link from "next/link";

type ViewMode = "week" | "list";

export default function CoachSchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

  const { events, isLoading, error } = useCoachEvents({
    initialParams: {
      startDate: format(weekStart, "yyyy-MM-dd"),
      endDate: format(weekEnd, "yyyy-MM-dd"),
    },
  });

  // Navigate weeks
  const goToPreviousWeek = () => setWeekStart(subWeeks(weekStart, 1));
  const goToNextWeek = () => setWeekStart(addWeeks(weekStart, 1));
  const goToToday = () => {
    const today = new Date();
    setWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
    setSelectedDate(today);
  };

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, typeof events> = {};
    events.forEach((event) => {
      const dateKey = format(new Date(event.date), "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    // Sort events within each day by start time
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return grouped;
  }, [events]);

  // Get events for selected date (in list view)
  const selectedDateEvents = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate[dateKey] || [];
  }, [selectedDate, eventsByDate]);

  // Generate week days for week view
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    let current = weekStart;
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    return days;
  }, [weekStart]);

  // Get event type color
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "CLASS":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      case "CLINIC":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
      case "TRYOUT":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800";
      case "MEETING":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Schedule</h1>
          <p className="text-muted-foreground">View your assigned classes and events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Week
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
              </span>
              <Button variant="ghost" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : viewMode === "week" ? (
        /* Week View */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate[dateKey] || [];
            const isToday = isSameDay(day, new Date());
            
            return (
              <Card 
                key={dateKey} 
                className={`${isToday ? "border-primary" : ""}`}
              >
                <CardHeader className="p-3 pb-2">
                  <CardTitle className={`text-sm ${isToday ? "text-primary" : ""}`}>
                    <span className="block text-xs text-muted-foreground">
                      {format(day, "EEE")}
                    </span>
                    {format(day, "d")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No events</p>
                  ) : (
                    dayEvents.map((event) => (
                      <Link 
                        key={event.id} 
                        href={`/coach/attendance?eventId=${event.id}`}
                        className="block"
                      >
                        <div 
                          className={`p-2 rounded-md border text-xs cursor-pointer hover:opacity-80 transition-opacity ${getEventTypeColor(event.type)}`}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="flex items-center gap-1 mt-1 opacity-80">
                            <Clock className="h-3 w-3" />
                            {event.startTime}
                          </div>
                          {event.organization && (
                            <div className="flex items-center gap-1 mt-0.5 opacity-70">
                              <Building2 className="h-3 w-3" />
                              <span className="truncate">{event.organization.name}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md"
              />
            </CardContent>
          </Card>
          
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDateEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No events scheduled for this day
                </p>
              ) : (
                selectedDateEvents.map((event) => (
                  <Card key={event.id} className="hover:bg-accent/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{event.title}</h3>
                            <Badge variant="outline" className={getEventTypeColor(event.type)}>
                              {event.type}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {event.startTime} - {event.endTime}
                            </span>
                            {event.program && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-4 w-4" />
                                {event.program.name}
                              </span>
                            )}
                            {event.attendanceCount !== undefined && (
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {event.attendanceCount} registered
                              </span>
                            )}
                            {event.organization && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                {event.organization.name}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <Link href={`/coach/attendance?eventId=${event.id}`}>
                          <Button size="sm" variant="outline">
                            <ClipboardCheck className="h-4 w-4 mr-1" />
                            Attendance
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary */}
      {!isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {events.length} event{events.length !== 1 ? "s" : ""} this week
              </span>
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Classes
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Camps
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  Competitions
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
