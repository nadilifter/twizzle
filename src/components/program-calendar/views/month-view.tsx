"use client";

import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalendarContext } from "../calendar-context";
import { EventPill, EventCard } from "../calendar-event";
import type { CalendarEvent } from "../types";

export function MonthView() {
  const { currentDate, setCurrentDate, setViewMode, events } = useCalendarContext();

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

  // Get events for a specific day
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events
      .filter((event) => {
        try {
          return isSameDay(parseISO(event.start), day);
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // Days with events for mobile view
  const daysWithEvents = useMemo(() => {
    return calendarDays.filter((day) => {
      const dayEvents = getEventsForDay(day);
      return dayEvents.length > 0 && isSameMonth(day, currentDate);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDays, events, currentDate]);

  const handleDayClick = (day: Date) => {
    setCurrentDate(day);
    setViewMode("day");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Desktop Day Headers */}
      <div className="hidden md:grid grid-cols-7 border-t border-border divide-x divide-border bg-muted/50">
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
      <div className="hidden md:grid grid-cols-7 flex-1 border-t auto-rows-fr [&>div]:border-l [&>div]:border-border [&>div:nth-child(7n+1)]:border-l-0 [&>div:nth-last-child(-n+7)]:border-b-0">
        {calendarDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[100px] border-b p-1.5 cursor-pointer transition-colors",
                "hover:bg-muted/30",
                !isCurrentMonth && "bg-muted/20"
              )}
              onClick={() => handleDayClick(day)}
            >
              <div
                className={cn(
                  "text-sm w-7 h-7 flex items-center justify-center rounded-full mb-1 transition-colors",
                  isTodayDate && "bg-primary text-primary-foreground font-bold",
                  !isCurrentMonth && !isTodayDate && "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventPill key={event.id} event={event} showTime={true} />
                ))}
                {dayEvents.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDayClick(day);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground w-full text-left px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
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
      <ScrollArea className="md:hidden flex-1 border-t">
        <div className="p-3 space-y-4">
          {daysWithEvents.length > 0 ? (
            daysWithEvents.map((day) => {
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
                        "w-8 h-8 flex items-center justify-center rounded-full text-sm",
                        isTodayDate && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <span>{format(day, "EEEE, MMM d")}</span>
                  </div>
                  <div className="space-y-2 pl-10">
                    {dayEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">No sessions this month</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
