"use client";

import { useState, useMemo, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  format,
  addMonths,
  subMonths,
  parseISO,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, MapPin, Users, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface SessionInstance {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  registrationCount: number;
  facility?: { name: string; city?: string | null };
}

interface SessionCalendarProps {
  instances: SessionInstance[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onBulkSelect?: (ids: string[]) => void;
  waitlistEnabled?: boolean;
  perSessionPrice?: number | null;
  primaryColor?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SessionCalendar({
  instances,
  selectedIds,
  onToggle,
  onBulkSelect,
  waitlistEnabled = false,
  perSessionPrice,
  primaryColor,
}: SessionCalendarProps) {
  const firstInstanceDate = instances.length > 0 ? parseISO(instances[0].date) : new Date();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(firstInstanceDate));
  const [quickSelectDay, setQuickSelectDay] = useState<number | null>(null);
  const [quickSelectMonth, setQuickSelectMonth] = useState<string | null>(null); // "all" or "yyyy-MM"
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);

  const instancesByDay = useMemo(() => {
    const map = new Map<string, SessionInstance[]>();
    for (const inst of instances) {
      const key = format(parseISO(inst.date), "yyyy-MM-dd");
      const existing = map.get(key) || [];
      existing.push(inst);
      map.set(key, existing);
    }
    return map;
  }, [instances]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const hasInstancesInMonth = useCallback(
    (month: Date) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      return instances.some((inst) => {
        const d = parseISO(inst.date);
        return d >= monthStart && d <= monthEnd;
      });
    },
    [instances]
  );

  const availableByDayAndTime = useMemo(() => {
    const map = new Map<number, Map<string, SessionInstance[]>>();
    for (const inst of instances) {
      const isFull = inst.capacity !== undefined && inst.registrationCount >= inst.capacity;
      const isUnavailable = isFull && !waitlistEnabled;
      if (isUnavailable) continue;

      const dayOfWeek = parseISO(inst.date).getDay();
      if (!map.has(dayOfWeek)) map.set(dayOfWeek, new Map());
      const timeMap = map.get(dayOfWeek)!;
      const existing = timeMap.get(inst.startTime) || [];
      existing.push(inst);
      timeMap.set(inst.startTime, existing);
    }
    return map;
  }, [instances, waitlistEnabled]);

  const availableDays = useMemo(() => {
    return Array.from(availableByDayAndTime.keys()).sort((a, b) => a - b);
  }, [availableByDayAndTime]);

  const monthsForSelectedDay = useMemo(() => {
    if (quickSelectDay === null) return [];
    const timeMap = availableByDayAndTime.get(quickSelectDay);
    if (!timeMap) return [];
    const monthSet = new Set<string>();
    for (const sessions of timeMap.values()) {
      for (const s of sessions) {
        monthSet.add(format(parseISO(s.date), "yyyy-MM"));
      }
    }
    return Array.from(monthSet).sort();
  }, [quickSelectDay, availableByDayAndTime]);

  const filteredSessionsForDayAndMonth = useMemo(() => {
    if (quickSelectDay === null || quickSelectMonth === null)
      return new Map<string, SessionInstance[]>();
    const timeMap = availableByDayAndTime.get(quickSelectDay);
    if (!timeMap) return new Map<string, SessionInstance[]>();

    const filtered = new Map<string, SessionInstance[]>();
    for (const [time, sessions] of timeMap) {
      const matching =
        quickSelectMonth === "all"
          ? sessions
          : sessions.filter((s) => format(parseISO(s.date), "yyyy-MM") === quickSelectMonth);
      if (matching.length > 0) filtered.set(time, matching);
    }
    return filtered;
  }, [quickSelectDay, quickSelectMonth, availableByDayAndTime]);

  const timesForSelectedDayAndMonth = useMemo(() => {
    return Array.from(filteredSessionsForDayAndMonth.keys()).sort();
  }, [filteredSessionsForDayAndMonth]);

  const handleQuickSelectDay = useCallback((day: number) => {
    setQuickSelectDay(day);
    setQuickSelectMonth(null);
  }, []);

  const handleQuickSelectTime = useCallback(
    (time: string) => {
      const sessions = filteredSessionsForDayAndMonth.get(time) || [];
      const ids = sessions.filter((inst) => !selectedIds.has(inst.id)).map((inst) => inst.id);
      if (ids.length > 0) onBulkSelect?.(ids);
      setQuickSelectDay(null);
      setQuickSelectMonth(null);
      setQuickSelectOpen(false);
    },
    [filteredSessionsForDayAndMonth, selectedIds, onBulkSelect]
  );

  const handlePrev = () => setCurrentMonth((m) => subMonths(m, 1));
  const handleNext = () => setCurrentMonth((m) => addMonths(m, 1));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Month header + quick add */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-semibold tracking-tight min-w-[10rem] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {onBulkSelect && availableDays.length > 0 && (
            <Popover
              open={quickSelectOpen}
              onOpenChange={(open) => {
                setQuickSelectOpen(open);
                if (!open) {
                  setQuickSelectDay(null);
                  setQuickSelectMonth(null);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Quick add
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                {/* Step 1: Pick a day */}
                {quickSelectDay === null && (
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Pick a day</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {availableDays.map((day) => {
                        const timeCount = availableByDayAndTime.get(day)?.size ?? 0;
                        const sessionCount = Array.from(
                          availableByDayAndTime.get(day)?.values() ?? []
                        ).reduce((sum, arr) => sum + arr.length, 0);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleQuickSelectDay(day)}
                            className="text-left rounded-md border px-3 py-2 hover:bg-accent transition-colors"
                          >
                            <span className="text-sm font-medium">{WEEKDAYS[day]}s</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {timeCount} time{timeCount !== 1 ? "s" : ""} &middot; {sessionCount}{" "}
                              session{sessionCount !== 1 ? "s" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2: Pick a date range (month filter) */}
                {quickSelectDay !== null && quickSelectMonth === null && (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickSelectDay(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-xs font-medium text-muted-foreground">
                        Which {WEEKDAYS[quickSelectDay]}s?
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setQuickSelectMonth("all")}
                        className="w-full text-left rounded-md border px-3 py-2 hover:bg-accent transition-colors"
                      >
                        <span className="text-sm font-medium">All {WEEKDAYS[quickSelectDay]}s</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {monthsForSelectedDay.length > 1
                            ? `${format(parseISO(monthsForSelectedDay[0] + "-01"), "MMM")} – ${format(parseISO(monthsForSelectedDay[monthsForSelectedDay.length - 1] + "-01"), "MMM yyyy")}`
                            : format(parseISO(monthsForSelectedDay[0] + "-01"), "MMMM yyyy")}
                        </span>
                      </button>
                      {monthsForSelectedDay.length > 1 &&
                        monthsForSelectedDay.map((ym) => (
                          <button
                            key={ym}
                            type="button"
                            onClick={() => setQuickSelectMonth(ym)}
                            className="w-full text-left rounded-md border px-3 py-2 hover:bg-accent transition-colors"
                          >
                            <span className="text-sm font-medium">
                              {format(parseISO(ym + "-01"), "MMMM yyyy")}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Pick a time */}
                {quickSelectDay !== null && quickSelectMonth !== null && (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickSelectMonth(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-xs font-medium text-muted-foreground">
                        {WEEKDAYS[quickSelectDay]}s
                        {quickSelectMonth !== "all" &&
                          ` in ${format(parseISO(quickSelectMonth + "-01"), "MMM")}`}{" "}
                        — pick a time
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {timesForSelectedDayAndMonth.map((time) => {
                        const sessions = filteredSessionsForDayAndMonth.get(time) ?? [];
                        const unselectedCount = sessions.filter(
                          (s) => !selectedIds.has(s.id)
                        ).length;
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => handleQuickSelectTime(time)}
                            disabled={unselectedCount === 0}
                            className={cn(
                              "w-full text-left rounded-md border px-3 py-2 transition-colors",
                              unselectedCount === 0
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-accent"
                            )}
                          >
                            <span className="text-sm font-medium">{time}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {unselectedCount === 0
                                ? "All already selected"
                                : `Add ${unselectedCount} session${unselectedCount !== 1 ? "s" : ""}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px rounded-xl border bg-border/50 overflow-hidden shadow-sm">
          {calendarDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const daySessions = instancesByDay.get(dayKey) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={dayKey}
                className={cn(
                  "min-h-[5.5rem] md:min-h-[6.5rem] bg-background p-1 md:p-1.5 transition-colors relative",
                  !inMonth && "bg-muted/20"
                )}
              >
                {/* Day number */}
                <div
                  className={cn(
                    "text-xs font-medium mb-0.5 text-right",
                    !inMonth
                      ? "text-muted-foreground/30"
                      : today
                        ? "text-primary font-bold"
                        : "text-muted-foreground/70"
                  )}
                >
                  {today ? (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px]"
                      style={{ backgroundColor: primaryColor || "hsl(var(--primary))" }}
                    >
                      {format(day, "d")}
                    </span>
                  ) : (
                    format(day, "d")
                  )}
                </div>

                {/* Session chips */}
                <div className="space-y-0.5">
                  {daySessions.map((session) => {
                    const isFull =
                      session.capacity !== undefined &&
                      session.registrationCount >= session.capacity;
                    const hasWaitlist = isFull && waitlistEnabled;
                    const isUnavailable = isFull && !hasWaitlist;
                    const isSelected = selectedIds.has(session.id);
                    const spotsLeft = session.capacity
                      ? Math.max(0, session.capacity - session.registrationCount)
                      : null;

                    return (
                      <Tooltip key={session.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => !isUnavailable && onToggle(session.id)}
                            disabled={isUnavailable}
                            className={cn(
                              "block w-fit ml-auto md:ml-0 text-[10px] md:text-xs leading-tight rounded-md px-1 py-1 transition-all font-medium",
                              isSelected
                                ? "text-white shadow-sm"
                                : isUnavailable
                                  ? "bg-muted/80 text-muted-foreground/40 line-through cursor-not-allowed"
                                  : hasWaitlist
                                    ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 cursor-pointer"
                                    : "bg-primary/8 text-foreground hover:bg-primary/15 cursor-pointer"
                            )}
                            style={
                              isSelected && primaryColor
                                ? { backgroundColor: primaryColor }
                                : undefined
                            }
                          >
                            <span>
                              {session.startTime}
                              <span className="hidden md:inline">–{session.endTime}</span>
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[220px] bg-popover text-popover-foreground border shadow-md"
                        >
                          <div className="space-y-1.5 text-xs">
                            <div className="font-semibold">
                              {format(parseISO(session.date), "EEEE, MMM d")}
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              {session.startTime} – {session.endTime}
                            </div>
                            {session.facility && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {session.facility.name}
                              </div>
                            )}
                            {spotsLeft !== null && (
                              <div
                                className={cn(
                                  "flex items-center gap-1.5",
                                  isFull ? "text-red-500" : "text-muted-foreground"
                                )}
                              >
                                <Users className="h-3 w-3 shrink-0" />
                                {isFull
                                  ? hasWaitlist
                                    ? "Full — Waitlist available"
                                    : "Full"
                                  : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} available`}
                              </div>
                            )}
                            {perSessionPrice != null && perSessionPrice > 0 && (
                              <div className="font-semibold pt-0.5 border-t border-border text-foreground">
                                {formatPrice(perSessionPrice)}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!hasInstancesInMonth(currentMonth) && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No sessions scheduled this month.</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
