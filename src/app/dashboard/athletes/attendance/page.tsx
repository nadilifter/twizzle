"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, X, Clock, Loader2, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { useAttendance } from "@/hooks/use-attendance"
import { usePrograms } from "@/hooks/use-programs"
import { useEvents } from "@/hooks/use-events"
import { useEnrollments } from "@/hooks/use-enrollments"
import { toast } from "sonner"
import type { AttendanceStatus } from "@/types/attendance"

export default function AttendancePage() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [selectedProgramId, setSelectedProgramId] = useState<string>("")
  const [selectedEventId, setSelectedEventId] = useState<string>("")

  // Hooks
  const { programs, fetchPrograms, isLoading: isLoadingPrograms } = usePrograms({ autoFetch: true })
  const { events, fetchEvents, isLoading: isLoadingEvents } = useEvents({ autoFetch: false })
  const { enrollments, fetchEnrollments, isLoading: isLoadingEnrollments } = useEnrollments({ autoFetch: false })
  const { attendances, fetchAttendance, markAttendance, isLoading: isLoadingAttendance } = useAttendance({ autoFetch: false })

  // Derived state for stats
  const stats = {
    present: attendances.filter(a => a.status === "PRESENT").length,
    absent: attendances.filter(a => a.status === "ABSENT").length,
    late: attendances.filter(a => a.status === "LATE").length,
  }

  // Fetch events when date or program changes
  useEffect(() => {
    if (date && selectedProgramId) {
      const dateStr = format(date, "yyyy-MM-dd")
      fetchEvents({ 
        startDate: dateStr, 
        endDate: dateStr, 
        programId: selectedProgramId 
      }).then(() => {
        // We will handle setting the selectedEventId in a separate effect or after fetch
        // Note: fetchEvents updates the `events` state.
      })
      
      // Also fetch enrollments for this program to know who SHOULD be there
      fetchEnrollments({ programId: selectedProgramId, status: "ACTIVE" })
    }
  }, [date, selectedProgramId, fetchEvents, fetchEnrollments])

  // Select the first event if available, or clear selection
  useEffect(() => {
    if (events.length > 0) {
      setSelectedEventId(events[0].id)
    } else {
      setSelectedEventId("")
    }
  }, [events])

  // Fetch attendance when event is selected
  useEffect(() => {
    if (selectedEventId) {
      fetchAttendance({ eventId: selectedEventId })
    }
  }, [selectedEventId, fetchAttendance])

  // Combined list of students (enrolled + any extra attendance records not in enrollment?)
  // For now, we drive the list by Enrollments (active students)
  const studentList = enrollments.map(enrollment => {
    const attendance = attendances.find(a => a.athleteId === enrollment.athlete.id)
    return {
      athlete: enrollment.athlete,
      attendance
    }
  })

  const handleMarkAttendance = async (athleteId: string, status: AttendanceStatus) => {
    if (!selectedEventId) {
      toast.error("No event selected")
      return
    }

    const result = await markAttendance({
      athleteId,
      eventId: selectedEventId,
      status,
    })

    if (result) {
      // toast.success(`Marked as ${status.toLowerCase()}`)
    }
  }

  const isLoading = isLoadingPrograms || isLoadingEvents || isLoadingEnrollments || isLoadingAttendance

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          Track daily attendance for training groups.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border w-full flex justify-center"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Class Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Present</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{stats.present}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Absent</span>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{stats.absent}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Late</span>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{stats.late}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select Program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map(program => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name} ({program.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* <Button variant="outline">Mark All Present</Button> */}
          </div>

          {!selectedProgramId ? (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg border-dashed">
              <p className="text-muted-foreground">Select a program to view attendance</p>
            </div>
          ) : events.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 border rounded-lg border-dashed">
              <p className="text-muted-foreground">No events found for this program on the selected date.</p>
              <Button variant="link" asChild className="mt-2">
                <a href="/dashboard/events">Schedule an Event</a>
              </Button>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b bg-muted/20">
                    <h3 className="font-medium">{events.find(e => e.id === selectedEventId)?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                        {events.find(e => e.id === selectedEventId)?.startTime} - {events.find(e => e.id === selectedEventId)?.endTime}
                    </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Check-in Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentList.map(({ athlete, attendance }) => (
                      <TableRow key={athlete.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={null} /> 
                              <AvatarFallback>{athlete.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {athlete.name}
                          </div>
                        </TableCell>
                        <TableCell>
                            {attendance?.checkedIn ? format(new Date(attendance.checkedIn), "hh:mm a") : "-"}
                        </TableCell>
                        <TableCell>
                          {attendance ? (
                            <Badge 
                              variant="outline" 
                              className={
                                attendance.status === "PRESENT" ? "bg-green-50 text-green-700 border-green-200" :
                                attendance.status === "ABSENT" ? "bg-red-50 text-red-700 border-red-200" :
                                "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              {attendance.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">Not marked</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className={`h-8 w-8 ${attendance?.status === "PRESENT" ? "bg-green-100 text-green-700" : "text-green-600 hover:text-green-700 hover:bg-green-50"}`}
                                onClick={() => handleMarkAttendance(athlete.id, "PRESENT")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className={`h-8 w-8 ${attendance?.status === "LATE" ? "bg-yellow-100 text-yellow-700" : "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"}`}
                                onClick={() => handleMarkAttendance(athlete.id, "LATE")}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className={`h-8 w-8 ${attendance?.status === "ABSENT" ? "bg-red-100 text-red-700" : "text-red-600 hover:text-red-700 hover:bg-red-50"}`}
                                onClick={() => handleMarkAttendance(athlete.id, "ABSENT")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {studentList.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                No athletes enrolled in this program.
                            </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
