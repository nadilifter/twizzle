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

/**
 * Convert 24-hour time string to 12-hour AM/PM format
 * @param time24 - Time in "HH:mm" format (e.g., "14:30")
 * @param compact - If true, uses compact format "9:30a" instead of "9:30 AM"
 * @returns Time in AM/PM format
 */
function formatTime12h(time24: string, compact: boolean = false): string {
  const [hoursStr, minutes] = time24.split(":");
  const hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? (compact ? "p" : "PM") : (compact ? "a" : "AM");
  const hours12 = hours % 12 || 12;
  return compact ? `${hours12}:${minutes}${period}` : `${hours12}:${minutes} ${period}`;
}

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
        showTime && "flex flex-col",
        className
      )}
      title={`${event.title} - ${formatTime12h(event.startTime)} to ${formatTime12h(event.endTime)}`}
    >
      {showTime ? (
        <>
          <span className="text-[10px] opacity-75">{formatTime12h(event.startTime, true)}</span>
          <span className="truncate">{event.title}</span>
        </>
      ) : (
        <span className="truncate">{event.title}</span>
      )}
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
            {formatTime12h(event.startTime)} - {formatTime12h(event.endTime)}
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
            {formatTime12h(event.startTime)} - {formatTime12h(event.endTime)}
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
