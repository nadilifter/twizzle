"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { X, CalendarDays, Clock, MapPin, User, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAttendance } from "@/hooks/use-attendance";
import { cn } from "@/lib/utils";
import { formatTime12h } from "@/lib/date-utils";
import type { AttendanceWithRelations, AttendanceStatus } from "@/types/attendance";
import { athleteDisplayName } from "@/lib/athlete-name";

interface AttendanceDetailSheetProps {
  athleteId: string | null;
  athleteName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<AttendanceStatus, { color: string; bgColor: string; label: string }> = {
  REGISTERED: {
    color: "text-gray-700",
    bgColor: "bg-gray-100 border-gray-200",
    label: "Registered",
  },
  PRESENT: { color: "text-green-700", bgColor: "bg-green-100 border-green-200", label: "Present" },
  ABSENT: { color: "text-red-700", bgColor: "bg-red-100 border-red-200", label: "Absent" },
  LATE: { color: "text-yellow-700", bgColor: "bg-yellow-100 border-yellow-200", label: "Late" },
  EXCUSED: { color: "text-blue-700", bgColor: "bg-blue-100 border-blue-200", label: "Excused" },
};

export function AttendanceDetailSheet({
  athleteId,
  athleteName,
  open,
  onOpenChange,
}: AttendanceDetailSheetProps) {
  const { attendances, isLoading, fetchAttendance } = useAttendance();
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    rate: 0,
  });

  useEffect(() => {
    if (open && athleteId) {
      fetchAttendance({ athleteId });
    }
  }, [open, athleteId, fetchAttendance]);

  useEffect(() => {
    if (attendances.length > 0) {
      const present = attendances.filter((a) => a.status === "PRESENT").length;
      const absent = attendances.filter((a) => a.status === "ABSENT").length;
      const late = attendances.filter((a) => a.status === "LATE").length;
      const excused = attendances.filter((a) => a.status === "EXCUSED").length;
      const total = attendances.length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

      setStats({ total, present, absent, late, excused, rate });
    } else {
      setStats({ total: 0, present: 0, absent: 0, late: 0, excused: 0, rate: 0 });
    }
  }, [attendances]);

  const getStatusBadge = (status: AttendanceStatus) => {
    const config = statusConfig[status];
    return (
      <Badge variant="outline" className={cn(config.bgColor, config.color)}>
        {config.label}
      </Badge>
    );
  };

  // Sort attendances by date (most recent first)
  const sortedAttendances = [...attendances].sort((a, b) => {
    const dateA = new Date(a.event.date);
    const dateB = new Date(b.event.date);
    return dateB.getTime() - dateA.getTime();
  });

  // Get athlete info from first attendance record
  const athlete = attendances[0]?.athlete;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-hidden p-0 [&>button]:hidden"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={athlete?.avatar || undefined}
                    alt={athleteName || (athlete ? athleteDisplayName(athlete) : "Athlete")}
                  />
                  <AvatarFallback className="text-lg">
                    {(athleteName || (athlete ? athleteDisplayName(athlete) : "?") || "?").charAt(
                      0
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-lg font-semibold">
                    {athleteName || (athlete ? athleteDisplayName(athlete) : "Athlete")}
                  </SheetTitle>
                  {athlete?.level && (
                    <p className="text-sm text-muted-foreground">{athlete.level}</p>
                  )}
                </div>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          {/* Stats Summary */}
          <div className="px-6 py-4 bg-muted/30 border-b">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Attendance Rate</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-base font-bold",
                  stats.rate >= 90
                    ? "bg-green-100 text-green-700 border-green-200"
                    : stats.rate >= 70
                      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                      : "bg-red-100 text-red-700 border-red-200"
                )}
              >
                {stats.rate}%
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-background rounded-lg p-2 border">
                <div className="text-lg font-bold text-green-600">{stats.present}</div>
                <div className="text-xs text-muted-foreground">Present</div>
              </div>
              <div className="bg-background rounded-lg p-2 border">
                <div className="text-lg font-bold text-red-600">{stats.absent}</div>
                <div className="text-xs text-muted-foreground">Absent</div>
              </div>
              <div className="bg-background rounded-lg p-2 border">
                <div className="text-lg font-bold text-yellow-600">{stats.late}</div>
                <div className="text-xs text-muted-foreground">Late</div>
              </div>
              <div className="bg-background rounded-lg p-2 border">
                <div className="text-lg font-bold text-blue-600">{stats.excused}</div>
                <div className="text-xs text-muted-foreground">Excused</div>
              </div>
            </div>
          </div>

          {/* Attendance History */}
          <ScrollArea className="flex-1">
            <div className="px-6 py-4">
              <h3 className="text-sm font-semibold mb-4">Attendance History</h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sortedAttendances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p className="text-sm">No attendance records found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedAttendances.map((attendance) => (
                    <div
                      key={attendance.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "mt-0.5 p-1.5 rounded-full",
                          attendance.status === "PRESENT"
                            ? "bg-green-100"
                            : attendance.status === "ABSENT"
                              ? "bg-red-100"
                              : attendance.status === "LATE"
                                ? "bg-yellow-100"
                                : attendance.status === "EXCUSED"
                                  ? "bg-blue-100"
                                  : "bg-gray-100"
                        )}
                      >
                        {attendance.status === "PRESENT" ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : attendance.status === "ABSENT" ? (
                          <X className="h-3.5 w-3.5 text-red-600" />
                        ) : attendance.status === "LATE" ? (
                          <Clock className="h-3.5 w-3.5 text-yellow-600" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{attendance.event.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <CalendarDays className="h-3 w-3" />
                              <span>{format(new Date(attendance.event.date), "MMM d, yyyy")}</span>
                              <span>•</span>
                              <span>
                                {formatTime12h(attendance.event.startTime)} -{" "}
                                {formatTime12h(attendance.event.endTime)}
                              </span>
                            </div>
                            {attendance.event.program && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <User className="h-3 w-3" />
                                <span>{attendance.event.program.name}</span>
                              </div>
                            )}
                          </div>
                          {getStatusBadge(attendance.status)}
                        </div>
                        {attendance.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Note: {attendance.notes}
                          </p>
                        )}
                        {attendance.checkedIn && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Checked in: {format(new Date(attendance.checkedIn), "h:mm a")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
