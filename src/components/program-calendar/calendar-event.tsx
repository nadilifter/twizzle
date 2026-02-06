"use client";

import { Clock, MapPin, Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCalendarContext } from "./calendar-context";
import {
  getEventPillClasses,
  getEventCardClasses,
  getBadgeColorClasses,
} from "./color-utils";
import type { CalendarEvent } from "./types";

interface EventPillProps {
  event: CalendarEvent;
  showTime?: boolean;
  className?: string;
}

/**
 * Compact event pill for month/week grid views
 */
export function EventPill({ event, showTime = true, className }: EventPillProps) {
  const { onEventClick } = useCalendarContext();
  const isCancelled = event.status === "CANCELLED";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
      }}
      className={cn(
        getEventPillClasses(event.color, isCancelled),
        "w-full text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        className
      )}
      title={`${event.title} - ${event.startTime} to ${event.endTime}`}
    >
      {showTime ? `${event.startTime} ${event.title}` : event.title}
    </button>
  );
}

interface EventCardProps {
  event: CalendarEvent;
  className?: string;
}

/**
 * Full event card for day view and mobile views
 */
export function EventCard({ event, className }: EventCardProps) {
  const { onEventClick } = useCalendarContext();
  const isCancelled = event.status === "CANCELLED";

  return (
    <div
      onClick={() => onEventClick(event)}
      className={cn(getEventCardClasses(event.color, isCancelled), className)}
    >
      <div className="flex-1 min-w-0">
        {/* Title and badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "font-medium truncate",
              isCancelled && "line-through"
            )}
          >
            {event.title}
          </span>
          {event.levelName && (
            <Badge
              variant="outline"
              className={getBadgeColorClasses(event.color)}
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

        {/* Details row */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            {event.startTime} - {event.endTime}
          </span>
          {event.facilityName && (
            <span className="flex items-center gap-1 truncate max-w-[150px]">
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
}

interface EventCompactCardProps {
  event: CalendarEvent;
  className?: string;
}

/**
 * Compact card for mobile month view
 */
export function EventCompactCard({ event, className }: EventCompactCardProps) {
  const { onEventClick } = useCalendarContext();
  const isCancelled = event.status === "CANCELLED";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
      }}
      className={cn(
        getEventCardClasses(event.color, isCancelled),
        "w-full text-left p-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={cn("font-medium text-sm truncate", isCancelled && "line-through")}>
            {event.title}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {event.startTime} - {event.endTime}
          </div>
        </div>
        {event.levelName && (
          <Badge
            variant="outline"
            className={cn(getBadgeColorClasses(event.color), "text-[10px] px-1.5 py-0")}
          >
            {event.levelName}
          </Badge>
        )}
      </div>
    </button>
  );
}
