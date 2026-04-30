"use client";

import { Clock, MapPin, Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCalendarContext } from "./calendar-context";
import {
  getEventPillClasses,
  getEventPillStyles,
  getEventCardClasses,
  getEventCardStyles,
  getBadgeColorClasses,
  getBadgeStyles,
} from "./color-utils";
import { formatTime12h } from "@/lib/date-utils";
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

  const statusLabel = event.isSoldOut ? "FULL" : event.isWaitlistAvailable ? "WAITLIST" : null;

  const statusTagClass = statusLabel
    ? cn(
        "inline-block text-[8px] font-bold leading-none px-1 py-0.5 rounded",
        event.isSoldOut
          ? "bg-red-500/20 text-red-700 dark:text-red-300"
          : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
      )
    : null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
      }}
      className={cn(
        getEventPillClasses(event.color, isCancelled),
        "w-full text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        "flex flex-col",
        event.isSoldOut && "opacity-60",
        className
      )}
      style={getEventPillStyles(event.color)}
      title={`${event.title} - ${formatTime12h(event.startTime)} to ${formatTime12h(event.endTime)}${statusLabel ? ` - ${statusLabel}` : ""}`}
    >
      {showTime && (
        <span className="text-[10px] opacity-75 flex items-center gap-1">
          {formatTime12h(event.startTime, true)}
          {statusLabel && <span className={statusTagClass!}>{statusLabel}</span>}
        </span>
      )}
      <span className="truncate">{event.title}</span>
      {!showTime && statusLabel && (
        <span className={cn(statusTagClass!, "self-start")}>{statusLabel}</span>
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
  const { onEventClick, isPublic } = useCalendarContext();
  const isCancelled = event.status === "CANCELLED";

  return (
    <div
      onClick={() => onEventClick(event)}
      className={cn(getEventCardClasses(event.color, isCancelled), className)}
      style={getEventCardStyles(event.color)}
    >
      <div className="flex-1 min-w-0">
        {/* Title and badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("font-medium truncate", isCancelled && "line-through")}>
            {event.title}
          </span>
          {event.levelName && (
            <Badge
              variant="outline"
              className={getBadgeColorClasses(event.color)}
              style={getBadgeStyles(event.color)}
            >
              {event.levelName}
            </Badge>
          )}
          {event.isSoldOut && (
            <Badge variant="destructive" className="text-xs shrink-0">
              Sold Out
            </Badge>
          )}
          {event.isWaitlistAvailable && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Waitlist
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
          {!isPublic && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 shrink-0" />
              {event.registrationCount}
              {event.capacity && `/${event.capacity}`}
            </span>
          )}
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
      style={getEventCardStyles(event.color)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("font-medium text-sm truncate", isCancelled && "line-through")}>
              {event.title}
            </span>
            {event.isSoldOut && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                Sold Out
              </Badge>
            )}
            {event.isWaitlistAvailable && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                Waitlist
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span>
              {formatTime12h(event.startTime)} - {formatTime12h(event.endTime)}
            </span>
          </div>
        </div>
        {event.levelName && (
          <Badge
            variant="outline"
            className={cn(getBadgeColorClasses(event.color), "text-[10px] px-1.5 py-0")}
            style={getBadgeStyles(event.color)}
          >
            {event.levelName}
          </Badge>
        )}
      </div>
    </button>
  );
}
