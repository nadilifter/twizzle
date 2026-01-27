"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarIcon, MapPinIcon, UsersIcon, Loader2, AlertCircle, Plus } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { useEvents } from "@/hooks/use-events"

export default function EventsPage() {
  const { events, isLoading, error, fetchEvents } = useEvents()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Upcoming Events</h1>
          <p className="text-muted-foreground">
            Manage your club&apos;s schedule, competitions, and social gatherings.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && events.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && events.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p>Failed to load events</p>
            <Button variant="outline" onClick={() => fetchEvents()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {(!isLoading || events.length > 0) && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <Badge variant={event.type === "CAMP" || event.type === "COMPETITION" ? "default" : "secondary"}>
                      {event.type}
                  </Badge>
                </div>
                <CardTitle className="mt-4">{event.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(new Date(event.date), "MMM d, yyyy")} • {event.startTime} - {event.endTime}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4" />
                    {event.location?.name || "Location TBD"}
                  </div>
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4" />
                    {event.attendanceCount || 0} Confirmed Attendees
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/events/${event.id}`}>
                      View Details
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {events.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center h-64 border rounded-lg border-dashed">
              <p className="text-muted-foreground mb-4">No upcoming events found</p>
              <Button variant="outline">Create your first event</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


