"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarContext } from "./calendar-context";
import { CalendarHeader } from "./calendar-header";
import { CalendarSkeleton } from "./calendar-skeleton";
import { MonthView, WeekView, DayView } from "./views";
import type { CalendarEvent, ViewMode, ProgramCalendarProps } from "./types";

export function ProgramCalendar({
  initialDate,
  onEventClick,
  className,
  showHeader = true,
  slug,
  isPublic = false,
  eventFilter,
}: ProgramCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  // Fetch events when date range changes
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
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
      }

      // Use public API when slug is provided, otherwise use the auth-protected endpoint
      const apiUrl = slug
        ? `/api/public/calendar/instances?slug=${encodeURIComponent(slug)}&start=${start.toISOString()}&end=${end.toISOString()}`
        : `/api/calendar/instances?start=${start.toISOString()}&end=${end.toISOString()}`;

      const response = await fetch(apiUrl);

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [currentDate, viewMode, slug]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Filter events visible in current range
  const visibleEvents = useMemo(() => {
    const calendarStart =
      viewMode === "month"
        ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
        : viewMode === "week"
        ? startOfWeek(currentDate, { weekStartsOn: 0 })
        : startOfDay(currentDate);

    const calendarEnd =
      viewMode === "month"
        ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
        : viewMode === "week"
        ? endOfWeek(currentDate, { weekStartsOn: 0 })
        : endOfDay(currentDate);

    const dateFiltered = events.filter((event) => {
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
    return eventFilter ? dateFiltered.filter(eventFilter) : dateFiltered;
  }, [events, currentDate, viewMode, eventFilter]);

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      if (onEventClick) {
        onEventClick(event);
      } else {
        router.push(`/dashboard/calendar/instance/${event.id}`);
      }
    },
    [onEventClick, router]
  );

  const contextValue = useMemo(
    () => ({
      currentDate,
      setCurrentDate,
      viewMode,
      setViewMode,
      events: visibleEvents,
      loading,
      onEventClick: handleEventClick,
      isPublic,
    }),
    [currentDate, viewMode, visibleEvents, loading, handleEventClick, isPublic]
  );

  const renderView = () => {
    // Show skeleton on initial load
    if (initialLoad) {
      return <CalendarSkeleton viewMode={viewMode} />;
    }

    switch (viewMode) {
      case "month":
        return <MonthView />;
      case "week":
        return <WeekView />;
      case "day":
        return <DayView />;
    }
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      <Card className={cn("flex flex-col overflow-hidden", className)}>
        {showHeader && (
          <CardHeader className="pb-0">
            <CalendarHeader />
          </CardHeader>
        )}
        <CardContent className="flex-1 p-0 overflow-hidden">
          {renderView()}
        </CardContent>
      </Card>
    </CalendarContext.Provider>
  );
}
