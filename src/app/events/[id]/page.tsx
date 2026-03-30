"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  Check,
  Clock4,
  Loader2,
  UserCheck,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useEvent } from "@/hooks/use-events";
import { useAttendance } from "@/hooks/use-attendance";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EventCheckinPageProps {
  params: {
    id: string;
  };
}

function getInitials(name: string) {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

type FilterStatus = "all" | "registered" | "checked-in" | "not-checked-in";

export default function EventCheckinPage({ params }: EventCheckinPageProps) {
  const { event, isLoading, fetchEvent } = useEvent(params.id);
  const { markAttendance, isUpdating } = useAttendance();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleCheckin = async (athleteId: string, status: "PRESENT" | "LATE") => {
    if (!event) return;

    setProcessingId(athleteId);

    const result = await markAttendance({
      athleteId,
      eventId: event.id,
      status,
    });

    if (result) {
      toast.success(`Marked as ${status.toLowerCase()}`);
      fetchEvent();
    } else {
      toast.error("Failed to update attendance");
    }

    setProcessingId(null);
  };

  // Filter and search attendees
  const filteredAttendees = useMemo(() => {
    if (!event?.attendances) return [];

    let filtered = [...event.attendances];

    // Apply status filter
    if (filterStatus === "registered") {
      filtered = filtered.filter((a) => a.status === "REGISTERED");
    } else if (filterStatus === "checked-in") {
      filtered = filtered.filter((a) => a.status === "PRESENT" || a.status === "LATE");
    } else if (filterStatus === "not-checked-in") {
      filtered = filtered.filter((a) => a.status === "REGISTERED" || a.status === "ABSENT");
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => a.athlete.name.toLowerCase().includes(query));
    }

    // Sort: not checked in first, then alphabetically
    filtered.sort((a, b) => {
      const aCheckedIn = a.status === "PRESENT" || a.status === "LATE";
      const bCheckedIn = b.status === "PRESENT" || b.status === "LATE";
      if (aCheckedIn !== bCheckedIn) {
        return aCheckedIn ? 1 : -1;
      }
      return a.athlete.name.localeCompare(b.athlete.name);
    });

    return filtered;
  }, [event?.attendances, searchQuery, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    if (!event?.attendances) return { total: 0, checkedIn: 0, registered: 0 };

    const total = event.attendances.length;
    const checkedIn = event.attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const registered = event.attendances.filter((a) => a.status === "REGISTERED").length;

    return { total, checkedIn, registered };
  }, [event?.attendances]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
        <Button asChild>
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {event.type && (
            <Badge variant="secondary" className="text-xs">
              {event.type}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{event.title}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(new Date(event.date), "MMM d, yyyy")}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {event.startTime} - {event.endTime}
          </div>
          {event.location?.name && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.location.name}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Registered</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.checkedIn}</div>
            <div className="text-sm text-green-700 dark:text-green-400">Checked In</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.registered}</div>
            <div className="text-sm text-muted-foreground">Awaiting</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search athletes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Attendees</SelectItem>
                <SelectItem value="registered">Registered Only</SelectItem>
                <SelectItem value="checked-in">Checked In</SelectItem>
                <SelectItem value="not-checked-in">Not Checked In</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attendee List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Attendees ({filteredAttendees.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAttendees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery || filterStatus !== "all"
                ? "No attendees match your search/filter"
                : "No registered attendees for this event"}
            </div>
          ) : (
            <div className="divide-y">
              {filteredAttendees.map((attendance) => {
                const isCheckedIn = attendance.status === "PRESENT" || attendance.status === "LATE";
                const isProcessing = processingId === attendance.athlete.id;

                return (
                  <div
                    key={attendance.id}
                    className={`flex items-center justify-between p-4 gap-4 ${
                      isCheckedIn ? "bg-green-50/50 dark:bg-green-950/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={attendance.athlete.avatar || undefined} />
                        <AvatarFallback
                          className={`font-medium ${
                            isCheckedIn
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {getInitials(attendance.athlete.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{attendance.athlete.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={isCheckedIn ? "default" : "secondary"}
                            className={`text-xs ${
                              attendance.status === "PRESENT"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : attendance.status === "LATE"
                                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                                  : ""
                            }`}
                          >
                            {attendance.status === "REGISTERED" ? "Awaiting" : attendance.status}
                          </Badge>
                          {attendance.checkedIn && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(attendance.checkedIn), "h:mm a")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isCheckedIn && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700"
                          onClick={() => handleCheckin(attendance.athlete.id, "LATE")}
                          disabled={isProcessing || isUpdating}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Clock4 className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">Late</span>
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleCheckin(attendance.athlete.id, "PRESENT")}
                          disabled={isProcessing || isUpdating}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">Check In</span>
                        </Button>
                      </div>
                    )}

                    {isCheckedIn && (
                      <div className="flex items-center gap-2 text-green-600">
                        <UserCheck className="h-5 w-5" />
                        <span className="text-sm font-medium hidden sm:inline">Checked In</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
