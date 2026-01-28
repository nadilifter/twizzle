"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useCoachEvents } from "@/hooks/use-coach-events";
import { useAttendance } from "@/hooks/use-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Check, 
  X, 
  Clock, 
  Users, 
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  CalendarIcon,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AttendanceStatus = "REGISTERED" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface EnrolledAthlete {
  id: string;
  name: string;
  avatar: string | null;
  level: string;
  group: string;
}

export default function CoachAttendancePage() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId");
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [enrolledAthletes, setEnrolledAthletes] = useState<EnrolledAthlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Use coach events hook with date filtering
  const { events, isLoading: loadingEvents, fetchEvents } = useCoachEvents({
    autoFetch: false,
  });
  const { attendances, isLoading: loadingAttendance, isUpdating, markAttendance, fetchAttendance } = useAttendance();

  // Fetch events when date changes
  useEffect(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    fetchEvents({
      startDate: dateStr,
      endDate: dateStr,
    });
  }, [selectedDate, fetchEvents]);

  // Fetch attendance when event is selected
  useEffect(() => {
    if (selectedEventId) {
      fetchAttendance({ eventId: selectedEventId });
      fetchEnrolledAthletes(selectedEventId);
    }
  }, [selectedEventId, fetchAttendance]);

  // Auto-select first event when events change
  useEffect(() => {
    if (events.length > 0 && !events.find(e => e.id === selectedEventId)) {
      setSelectedEventId(events[0].id);
    } else if (events.length === 0) {
      setSelectedEventId(null);
      setEnrolledAthletes([]);
    }
  }, [events, selectedEventId]);

  // Fetch athletes enrolled in the event's program
  const fetchEnrolledAthletes = async (eventId: string) => {
    setLoadingAthletes(true);
    try {
      const event = events.find(e => e.id === eventId);
      if (event?.program?.id) {
        const response = await api.get<{ data: any[] }>("/api/enrollments", {
          programId: event.program.id,
          status: "ACTIVE",
        });
        setEnrolledAthletes(
          response.data.map((enrollment: any) => ({
            id: enrollment.athlete.id,
            name: enrollment.athlete.name,
            avatar: enrollment.athlete.avatar,
            level: enrollment.athlete.level,
            group: enrollment.athlete.group,
          }))
        );
      } else {
        setEnrolledAthletes([]);
      }
    } catch (error) {
      console.error("Error fetching enrolled athletes:", error);
      setEnrolledAthletes([]);
    } finally {
      setLoadingAthletes(false);
    }
  };

  // Get attendance status for an athlete
  const getAttendanceForAthlete = (athleteId: string) => {
    return attendances.find(a => a.athleteId === athleteId);
  };

  // Handle marking attendance
  const handleMarkAttendance = async (athleteId: string, status: AttendanceStatus) => {
    if (!selectedEventId) return;
    
    await markAttendance({
      athleteId,
      eventId: selectedEventId,
      status,
    });
  };

  // Bulk mark all athletes
  const handleBulkMark = useCallback(async (status: AttendanceStatus) => {
    if (!selectedEventId || enrolledAthletes.length === 0) return;
    
    setBulkUpdating(true);
    try {
      // Mark all athletes with the specified status
      await Promise.all(
        enrolledAthletes.map(athlete => 
          markAttendance({
            athleteId: athlete.id,
            eventId: selectedEventId,
            status,
          })
        )
      );
      toast.success(`Marked all athletes as ${status.toLowerCase()}`);
    } catch (error) {
      console.error("Error bulk marking attendance:", error);
      toast.error("Failed to mark all athletes");
    } finally {
      setBulkUpdating(false);
    }
  }, [selectedEventId, enrolledAthletes, markAttendance]);

  // Get selected event
  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId);
  }, [events, selectedEventId]);

  // Calculate stats
  const stats = useMemo(() => {
    const present = attendances.filter(a => a.status === "PRESENT").length;
    const absent = attendances.filter(a => a.status === "ABSENT").length;
    const late = attendances.filter(a => a.status === "LATE").length;
    const excused = attendances.filter(a => a.status === "EXCUSED").length;
    const total = enrolledAthletes.length;
    const unmarked = total - present - absent - late - excused;
    
    return { present, absent, late, excused, total, unmarked };
  }, [attendances, enrolledAthletes]);

  // Get status badge variant
  const getStatusBadge = (status?: AttendanceStatus) => {
    switch (status) {
      case "PRESENT":
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-200">Present</Badge>;
      case "ABSENT":
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200">Absent</Badge>;
      case "LATE":
        return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200">Late</Badge>;
      case "EXCUSED":
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200">Excused</Badge>;
      case "REGISTERED":
        return <Badge variant="outline">Registered</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not marked</Badge>;
    }
  };

  const isLoading = loadingEvents || loadingAttendance || loadingAthletes;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Mark attendance for your classes</p>
        </div>
        
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal w-[200px]")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "EEEE, MMM d")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Event Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Select Class</label>
              <Select 
                value={selectedEventId || undefined} 
                onValueChange={setSelectedEventId}
                disabled={loadingEvents}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent>
                  {events.length === 0 ? (
                    <SelectItem value="none" disabled>No classes on this date</SelectItem>
                  ) : (
                    events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        <span className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          {event.title} - {event.startTime}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {selectedEvent && (
              <div className="flex items-end gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {selectedEvent.startTime} - {selectedEvent.endTime}
                </div>
                {selectedEvent.program && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {selectedEvent.program.name}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedEventId && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.present}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.absent}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.late}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.excused}</p>
                <p className="text-xs text-muted-foreground">Excused</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unmarked}</p>
                <p className="text-xs text-muted-foreground">Unmarked</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Table */}
      {selectedEventId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Athletes ({enrolledAthletes.length})</CardTitle>
              
              {/* Bulk Actions */}
              {enrolledAthletes.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={bulkUpdating || isUpdating}>
                      Bulk Actions
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkMark("PRESENT")}>
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      Mark All Present
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkMark("ABSENT")}>
                      <X className="mr-2 h-4 w-4 text-red-600" />
                      Mark All Absent
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkMark("LATE")}>
                      <Clock className="mr-2 h-4 w-4 text-yellow-600" />
                      Mark All Late
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkMark("EXCUSED")}>
                      <Shield className="mr-2 h-4 w-4 text-blue-600" />
                      Mark All Excused
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : enrolledAthletes.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No athletes enrolled in this class
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledAthletes.map((athlete) => {
                    const attendance = getAttendanceForAthlete(athlete.id);
                    const currentStatus = attendance?.status;
                    
                    return (
                      <TableRow key={athlete.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={athlete.avatar || undefined} />
                              <AvatarFallback>
                                {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{athlete.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{athlete.level}</Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(currentStatus as AttendanceStatus | undefined)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant={currentStatus === "PRESENT" ? "default" : "outline"}
                              className={currentStatus === "PRESENT" ? "bg-green-600 hover:bg-green-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "PRESENT")}
                              disabled={isUpdating || bulkUpdating}
                              title="Present"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant={currentStatus === "LATE" ? "default" : "outline"}
                              className={currentStatus === "LATE" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "LATE")}
                              disabled={isUpdating || bulkUpdating}
                              title="Late"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant={currentStatus === "ABSENT" ? "default" : "outline"}
                              className={currentStatus === "ABSENT" ? "bg-red-600 hover:bg-red-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "ABSENT")}
                              disabled={isUpdating || bulkUpdating}
                              title="Absent"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant={currentStatus === "EXCUSED" ? "default" : "outline"}
                              className={currentStatus === "EXCUSED" ? "bg-blue-600 hover:bg-blue-700" : ""}
                              onClick={() => handleMarkAttendance(athlete.id, "EXCUSED")}
                              disabled={isUpdating || bulkUpdating}
                              title="Excused"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Events Message */}
      {!loadingEvents && events.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Classes on {format(selectedDate, "MMMM d, yyyy")}</h3>
            <p className="text-muted-foreground">
              You don&apos;t have any classes assigned for this date. Try selecting a different date or check your schedule.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
