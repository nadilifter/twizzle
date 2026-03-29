"use client"

import * as React from "react"
import Link from "next/link"
import { sanitizeHtml } from "@/lib/sanitize"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Plus, Search, Loader2, AlertCircle, CalendarDays,
  Clock, MapPin, Users, Shield, DollarSign, User, Star,
} from "lucide-react"
import { useEvents } from "@/hooks/use-events"
import { format } from "date-fns"

const EVENT_TYPE_LABELS: Record<string, string> = {
  CLASS: "Class",
  CLINIC: "Clinic",
  PARTY: "Party",
  TRYOUT: "Tryout",
  MEETING: "Meeting",
  OTHER: "Other",
}

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "Free"
  const numPrice = typeof price === "string" ? parseFloat(price) : price
  if (numPrice === 0) return "Free"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numPrice)
}

export default function EventsPage() {
  const { events, isLoading, error, fetchEvents } = useEvents({ autoFetch: false })
  const [searchTerm, setSearchTerm] = React.useState("")

  const hasFetched = React.useRef(false)
  React.useEffect(() => {
    const params = { search: searchTerm }
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchEvents(params)
      return
    }
    const timer = setTimeout(() => fetchEvents(params), 500)
    return () => clearTimeout(timer)
  }, [searchTerm, fetchEvents])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Manage your events, competitions, and gatherings.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/events/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search events..."
            className="pl-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading && events.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const e = event as any
            const capacity = e.capacity || 0
            const attendees = e.attendanceCount || 0
            const hasCapacity = capacity > 0
            const requiredMemberships = e.requiredMemberships || []
            const staffAssignments = e.staffAssignments || []

            return (
              <Card key={event.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 min-w-0">
                      <CardTitle className="leading-tight">{event.title}</CardTitle>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: (event as any).color || "#3b82f6" }}
                        />
                      </div>
                    </div>
                    <Badge
                      variant={event.type === "CLINIC" || event.type === "TRYOUT" ? "default" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {EVENT_TYPE_LABELS[event.type] || event.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  {event.description && (
                    <div
                      className="text-sm text-muted-foreground line-clamp-2 mb-3 [&>p]:m-0"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
                    />
                  )}

                  <div className="space-y-1.5">
                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{format(new Date(event.date), "MMM d, yyyy")}</span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{event.startTime} - {event.endTime}</span>
                    </div>

                    {/* Location */}
                    {(e.facility || event.location?.name) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>
                          {e.facility
                            ? `${e.facility.name}${e.facility.city ? `, ${e.facility.city}` : ""}`
                            : event.location?.name}
                        </span>
                      </div>
                    )}

                    {/* Price */}
                    {e.price != null && (
                      <div className="flex items-center gap-1 text-xs font-medium">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span>{formatPrice(e.price)}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags: capacity, membership */}
                  {(hasCapacity || requiredMemberships.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {hasCapacity && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-full">
                          <Users className="h-3 w-3" />
                          {`${attendees}/${capacity}`}
                        </div>
                      )}
                      {requiredMemberships.length > 0 && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                          <Shield className="h-3 w-3" />
                          Membership Req.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Staff */}
                  {staffAssignments.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {staffAssignments.slice(0, 3).map((sa: any) => (
                          <Avatar key={sa.id} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={sa.member?.user?.avatar || ""} />
                            <AvatarFallback className="text-[10px]">
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {staffAssignments.slice(0, 2).map((sa: any, i: number) => (
                          <span key={sa.id}>
                            {i > 0 && ", "}
                            {sa.member?.user?.name}
                            {sa.role === "LEAD" && <Star className="h-3 w-3 inline ml-0.5 text-amber-500" />}
                          </span>
                        ))}
                        {staffAssignments.length > 2 && (
                          <span> +{staffAssignments.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Coach fallback (legacy single coach field) */}
                  {staffAssignments.length === 0 && event.coach && (
                    <div className="mt-3 pt-2.5 border-t flex items-center gap-2">
                      <Avatar className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={event.coach.avatar || ""} />
                        <AvatarFallback className="text-[10px]">
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">
                        {event.coach.name}
                      </span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t pt-3 gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/dashboard/events/${event.id}`}>
                      View Details
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
          {events.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
              <p className="text-muted-foreground mb-4">No events found. Create one to get started.</p>
              <Button variant="outline" asChild>
                <Link href="/dashboard/events/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first event
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
