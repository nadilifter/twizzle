"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Edit,
  MoreHorizontal,
  Plus,
  Loader2,
  User,
  Star,
  Shield,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { useAthletes } from "@/hooks/use-athletes"
import { useAttendance } from "@/hooks/use-attendance"
import { useBreadcrumbOverride } from "@/components/breadcrumb-context"
import { toast } from "sonner"

const EVENT_TYPE_LABELS: Record<string, string> = {
  CLASS: "Class",
  CAMP: "Camp",
  PARTY: "Party",
  COMPETITION: "Competition",
  MEETING: "Meeting",
  OTHER: "Other",
}

const ROLE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  ASSISTANT: "Assistant",
  VOLUNTEER: "Volunteer",
  OBSERVER: "Observer",
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?"
  const parts = name.trim().split(" ")
  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function getAthleteName(athlete: { name?: string; firstName?: string; lastName?: string } | null | undefined) {
  if (!athlete) return "Unknown"
  const fullName = [athlete.firstName, athlete.lastName].filter(Boolean).join(" ")
  return fullName || athlete.name || "Unknown"
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { athletes } = useAthletes()
  const { markAttendance, isUpdating } = useAttendance()
  const [selectedAthleteId, setSelectedAthleteId] = useState("")
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useBreadcrumbOverride(
    event ? `/dashboard/events/${eventId}` : undefined,
    event?.title,
  )

  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${eventId}`)
      if (!response.ok) throw new Error("Failed to fetch event")
      const data = await response.json()
      setEvent(data)
    } catch (error) {
      toast.error("Failed to load event")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchEvent()
  }, [fetchEvent])

  const handleRegister = async () => {
    if (!selectedAthleteId || !event) return

    const result = await markAttendance({
      athleteId: selectedAthleteId,
      eventId: event.id,
      status: "REGISTERED",
    })

    if (result) {
      toast.success("Athlete registered successfully")
      setIsRegisterOpen(false)
      setSelectedAthleteId("")
      fetchEvent()
    } else {
      toast.error("Failed to register athlete")
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/events/${eventId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete event")
      toast.success("Event deleted")
      router.push("/dashboard/events")
    } catch (error) {
      toast.error("Failed to delete event")
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Event not found</h2>
          <Button asChild className="mt-4">
            <Link href="/dashboard/events">Back to Events</Link>
          </Button>
        </div>
      </div>
    )
  }

  const attendances = event.attendances || []
  const staffAssignments = event.staffAssignments || []
  const requiredMemberships = event.requiredMemberships || []
  const attendanceCount = event.attendanceCount || attendances.length

  // Filter athletes not already registered
  const registeredAthleteIds = new Set(attendances.map((a: any) => a.athlete?.id).filter(Boolean))
  const availableAthletes = athletes.filter((a) => !registeredAthleteIds.has(a.id))

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/events">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <Badge
                variant={event.type === "CAMP" || event.type === "COMPETITION" ? "default" : "secondary"}
              >
                {EVENT_TYPE_LABELS[event.type] || event.type}
              </Badge>
            </div>
            {event.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/events/${eventId}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Event</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &ldquo;{event.title}&rdquo;? This action cannot be undone
                  and will remove all attendee registrations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(new Date(event.date), "MMM d")}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.date), "EEEE, yyyy")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{event.startTime}</div>
            <p className="text-xs text-muted-foreground">to {event.endTime}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceCount}
              {event.capacity ? `/${event.capacity}` : ""}
            </div>
            <p className="text-xs text-muted-foreground">
              {event.capacity ? "registered" : "no cap"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffAssignments.length}</div>
            <p className="text-xs text-muted-foreground">assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Details */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium">Date</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(event.date), "EEEE, MMMM d, yyyy")}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium">Time</div>
                <div className="text-sm text-muted-foreground">
                  {event.startTime} - {event.endTime}
                </div>
              </div>
            </div>
            {event.facility && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Location</div>
                  <div className="text-sm text-muted-foreground">
                    {event.facility.name}
                    {event.facility.city && `, ${event.facility.city}`}
                    {event.facility.stateProvince && `, ${event.facility.stateProvince}`}
                  </div>
                </div>
              </div>
            )}
            {!event.facility && event.location?.name && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Location</div>
                  <div className="text-sm text-muted-foreground">
                    {event.location.name}
                    {event.location.address && ` - ${event.location.address}`}
                  </div>
                </div>
              </div>
            )}
            {event.capacity && (
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Capacity</div>
                  <div className="text-sm text-muted-foreground">
                    {attendanceCount} / {event.capacity} spots filled
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Meeting Link */}
          {event.meetingLink && (
            <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
              <Info className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Online Meeting</p>
                <a
                  href={event.meetingLink}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                  target="_blank"
                  rel="noreferrer"
                >
                  {event.meetingLink}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Required Memberships */}
          {requiredMemberships.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Required Memberships</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {requiredMemberships.map((m: any) => (
                  <Badge key={m.id} variant="outline" className="text-xs">
                    {m.group?.name ? `${m.group.name} - ` : ""}{m.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Staff Assignments */}
        <Card>
          <CardHeader>
            <CardTitle>Staff</CardTitle>
            <CardDescription>
              {staffAssignments.length} staff member{staffAssignments.length !== 1 ? "s" : ""} assigned
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staffAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No staff assigned to this event</p>
              </div>
            ) : (
              <div className="space-y-3">
                {staffAssignments.map((sa: any) => (
                  <div
                    key={sa.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={sa.member?.user?.avatar || ""} />
                      <AvatarFallback>
                        {sa.member?.user?.name
                          ? getInitials(sa.member.user.name)
                          : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {sa.member?.user?.name || "Unknown"}
                        </span>
                        {sa.role === "LEAD" && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <Star className="h-3 w-3 mr-1" />
                            Lead
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[sa.role] || sa.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Legacy coach fallback */}
            {staffAssignments.length === 0 && event.coach && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={event.coach.avatar || ""} />
                  <AvatarFallback>
                    {getInitials(event.coach.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{event.coach.name}</span>
                    <Badge variant="secondary" className="text-xs">Coach</Badge>
                  </div>
                  {event.coach.email && (
                    <p className="text-xs text-muted-foreground">{event.coach.email}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendees */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Attendees</CardTitle>
                <CardDescription>
                  {attendanceCount} registered
                </CardDescription>
              </div>
              <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Register
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register Athlete</DialogTitle>
                    <DialogDescription>
                      Select an athlete to register for this event.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="athlete-select">Athlete</Label>
                    <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select athlete..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAthletes.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No available athletes
                          </SelectItem>
                        ) : (
                          availableAthletes.map((athlete) => (
                            <SelectItem key={athlete.id} value={athlete.id}>
                              {athlete.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRegisterOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRegister}
                      disabled={isUpdating || !selectedAthleteId}
                    >
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Register
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {attendances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No attendees registered yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {attendances.map((attendance: any) => (
                  <div
                    key={attendance.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={attendance.athlete?.avatar || ""} />
                        <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                          {getInitials(getAthleteName(attendance.athlete))}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {getAthleteName(attendance.athlete)}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        attendance.status === "PRESENT"
                          ? "default"
                          : attendance.status === "ABSENT"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs shrink-0"
                    >
                      {attendance.status === "REGISTERED"
                        ? "Signed Up"
                        : attendance.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
