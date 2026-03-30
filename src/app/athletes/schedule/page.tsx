"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Clock,
  MapPin,
  Building2,
  Trophy,
  ClipboardList,
  Repeat,
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns";

interface ScheduleEvent {
  id: string;
  athleteId: string;
  athleteFirstName: string;
  athleteLastName: string;
  athleteAvatar: string | null;
  type: "instance" | "competition" | "enrollment";
  title: string;
  organizationName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  facilityName: string | null;
}

const typeConfig = {
  instance: { label: "Session", icon: ClipboardList, variant: "default" as const },
  competition: { label: "Competition", icon: Trophy, variant: "secondary" as const },
  enrollment: { label: "Recurring", icon: Repeat, variant: "outline" as const },
};

function formatDateHeading(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMMM d, yyyy");
}

function groupEventsByDate(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const groups = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const dateKey = format(parseISO(event.date), "yyyy-MM-dd");
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  }
  return groups;
}

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [athleteFilter, setAthleteFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [daysAhead, setDaysAhead] = useState<string>("30");

  useEffect(() => {
    async function fetchSchedule() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/athletes/me/schedule?days=${daysAhead}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        console.error("Error fetching schedule:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSchedule();
  }, [daysAhead]);

  const athletes = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (!map.has(e.athleteId)) {
        map.set(e.athleteId, `${e.athleteFirstName} ${e.athleteLastName}`.trim());
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (athleteFilter !== "all" && e.athleteId !== athleteFilter) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      return true;
    });
  }, [events, athleteFilter, typeFilter]);

  const groupedEvents = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[140px]" />
        </div>
        <Skeleton className="h-4 w-36" />
        <div className="space-y-6 max-w-4xl">
          <div>
            <Skeleton className="h-4 w-44 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-[72px] w-full rounded-xl" />
              <Skeleton className="h-[72px] w-full rounded-xl" />
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-52 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-[72px] w-full rounded-xl" />
              <Skeleton className="h-[72px] w-full rounded-xl" />
              <Skeleton className="h-[72px] w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <h1 className="text-2xl font-bold">Schedule</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={athleteFilter} onValueChange={setAthleteFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Athletes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Athletes</SelectItem>
            {athletes.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="instance">Sessions</SelectItem>
            <SelectItem value="competition">Competitions</SelectItem>
            <SelectItem value="enrollment">Recurring</SelectItem>
          </SelectContent>
        </Select>

        <Select value={daysAhead} onValueChange={setDaysAhead}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Next 7 days</SelectItem>
            <SelectItem value="14">Next 14 days</SelectItem>
            <SelectItem value="30">Next 30 days</SelectItem>
            <SelectItem value="60">Next 60 days</SelectItem>
            <SelectItem value="90">Next 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Event count */}
      <p className="text-sm text-muted-foreground">
        {filteredEvents.length} upcoming event{filteredEvents.length !== 1 ? "s" : ""}
      </p>

      {/* Events grouped by date */}
      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg mb-1">No upcoming events</h3>
            <p className="text-sm text-muted-foreground">
              Scheduled sessions, competitions, and recurring programs will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedEvents.entries()).map(([dateKey, dayEvents]) => {
            const heading = formatDateHeading(dayEvents[0].date);
            const dateObj = parseISO(dayEvents[0].date);
            const isCurrentDay = isToday(dateObj);

            return (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-3">
                  <h2
                    className={`text-sm font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {heading}
                  </h2>
                  {isCurrentDay && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      Today
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const cfg = typeConfig[event.type];
                    const TypeIcon = cfg.icon;
                    const initials =
                      `${event.athleteFirstName?.[0] || ""}${event.athleteLastName?.[0] || ""}`.toUpperCase();

                    return (
                      <Card key={event.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-9 h-9 shrink-0 mt-0.5">
                              <AvatarImage
                                src={event.athleteAvatar || undefined}
                                alt={`${event.athleteFirstName} ${event.athleteLastName}`}
                              />
                              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{event.title}</span>
                                <Badge
                                  variant={cfg.variant}
                                  className="text-[10px] px-1.5 py-0 shrink-0"
                                >
                                  <TypeIcon className="w-2.5 h-2.5 mr-0.5" />
                                  {cfg.label}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  {event.athleteFirstName} {event.athleteLastName}
                                </span>
                                {event.startTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {event.startTime}
                                    {event.endTime && ` - ${event.endTime}`}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {event.organizationName}
                                </span>
                                {event.facilityName && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {event.facilityName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0 mt-1">
                              {event.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
