"use client";

import { useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalendarContext } from "../calendar-context";
import { EventPill, EventCard } from "../calendar-event";
import type { CalendarEvent } from "../types";

export function WeekView() {
  const { currentDate, setCurrentDate, setViewMode, events } = useCalendarContext();

  // Generate week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({
      start,
      end: addDays(start, 6),
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

  const handleDayClick = (day: Date) => {
    setCurrentDate(day);
    setViewMode("day");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Desktop Week Headers */}
      <div className="hidden md:grid grid-cols-7 border-t border-border divide-x divide-border bg-muted/50">
        {weekDays.map((day) => {
          const isTodayDate = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "px-2 py-2 text-center cursor-pointer transition-colors",
                "hover:bg-muted/30",
                isTodayDate && "bg-primary/10"
              )}
              onClick={() => handleDayClick(day)}
            >
              <div className="text-xs font-medium text-muted-foreground">{format(day, "EEE")}</div>
              <div
                className={cn(
                  "text-lg w-8 h-8 flex items-center justify-center rounded-full mx-auto transition-colors",
                  isTodayDate && "bg-primary text-primary-foreground font-bold"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Week Grid */}
      <div className="hidden md:grid grid-cols-7 flex-1 border-t divide-x divide-border">
        {weekDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn("p-2 overflow-y-auto", isTodayDate && "bg-primary/5")}
            >
              <div className="space-y-1">
                {dayEvents.length > 0 ? (
                  dayEvents.map((event) => (
                    <EventPill key={event.id} event={event} showTime={true} />
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">No sessions</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Week List */}
      <ScrollArea className="md:hidden flex-1 border-t">
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
                      "w-8 h-8 flex items-center justify-center rounded-full text-sm",
                      isTodayDate && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <span>{format(day, "EEEE")}</span>
                </div>
                <div className="space-y-2 pl-10">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => <EventCard key={event.id} event={event} />)
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">No sessions</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
