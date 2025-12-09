import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarIcon, MapPinIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { events } from "@/mock-data/events"
import { format } from "date-fns"

export default function EventsPage() {
  // Filter for the specific gymnastics events we added (ids 1-4)
  const displayEvents = events.filter(e => ["1", "2", "3", "4"].includes(e.id));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Upcoming Events</h1>
          <p className="text-muted-foreground">
            Manage your club's schedule, competitions, and social gatherings.
          </p>
        </div>
        <Button>Create Event</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayEvents.map((event) => (
          <Card key={event.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <Badge variant={event.type === "Camp" || event.type === "Competition" ? "default" : "secondary"}>
                    {event.type || "Event"}
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
                  {event.participants.length} Confirmed Attendees
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
      </div>
    </div>
  )
}


