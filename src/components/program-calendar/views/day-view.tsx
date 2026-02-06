"use client";

import { useMemo } from "react";
import { isSameDay, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalendarContext } from "../calendar-context";
import { EventCard } from "../calendar-event";
import type { CalendarEvent } from "../types";

export function DayView() {
  const { currentDate, events } = useCalendarContext();

  // Get events for the current day
  const dayEvents = useMemo((): CalendarEvent[] => {
    return events
      .filter((event) => {
        try {
          return isSameDay(parseISO(event.start), currentDate);
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, currentDate]);

  return (
    <ScrollArea className="h-full border-t">
      <div className="p-4 space-y-3">
        {dayEvents.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Calendar className="h-14 w-14 mx-auto mb-4 opacity-30" />
            <p className="text-base">No sessions scheduled for this day</p>
            <p className="text-sm mt-1">
              Try navigating to another date or switching to month view
            </p>
          </div>
        ) : (
          dayEvents.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>
    </ScrollArea>
  );
}
