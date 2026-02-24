"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Clock, 
  MapPin, 
  Users, 
  ArrowRight,
  ScanLine,
  Loader2,
  CalendarX
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { useEvents } from "@/hooks/use-events"
import { useEffect, useMemo } from "react"

export default function EventsPortalPage() {
  const { events, fetchEvents, isLoading } = useEvents({ autoFetch: false })
  
  // Fetch today's events
  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd")
    fetchEvents({ startDate: today, endDate: today })
  }, [fetchEvents])

  // Calculate stats
  const stats = useMemo(() => {
    const totalEvents = events.length
    const totalRegistered = events.reduce((sum, event) => 
      sum + (event.attendanceCount || 0), 0
    )
    const totalCapacity = events.reduce((sum, event) => sum + (event.capacity || 0), 0)
    
    return { totalEvents, totalRegistered, totalCapacity }
  }, [events])

  // Sort events by start time
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = a.startTime || "00:00"
      const timeB = b.startTime || "00:00"
      return timeA.localeCompare(timeB)
    })
  }, [events])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Today&apos;s Schedule</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link href="/events/scan">
            <ScanLine className="h-5 w-5" />
            Quick Check-in
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{stats.totalEvents}</div>
            <div className="text-sm text-muted-foreground">Events Today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.totalRegistered}</div>
            <div className="text-sm text-muted-foreground">Registered</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {stats.totalCapacity > 0 ? stats.totalCapacity : "∞"}
            </div>
            <div className="text-sm text-muted-foreground">Total Capacity</div>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      {sortedEvents.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Events Scheduled</h3>
          <p className="text-muted-foreground">
            There are no events scheduled for today.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedEvents.map((event) => {
            const registered = event.attendanceCount || 0
            const capacityText = event.capacity ? `${registered}/${event.capacity}` : registered
            
            return (
              <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row">
                  {/* Time Column */}
                  <div className="bg-primary/5 dark:bg-primary/10 p-4 md:p-6 md:w-32 flex flex-row md:flex-col items-center md:justify-center gap-2 md:gap-1 border-b md:border-b-0 md:border-r">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-lg">{event.startTime}</span>
                    {event.endTime && (
                      <span className="text-xs text-muted-foreground">to {event.endTime}</span>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {event.type && (
                            <Badge variant="secondary" className="text-xs">
                              {event.type}
                            </Badge>
                          )}
                          {event.program && (
                            <Badge variant="outline" className="text-xs">
                              {event.program.name}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {event.location?.name && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.location.name}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {capacityText} registered
                          </div>
                          
                        </div>
                      </div>
                      
                      {/* Action */}
                      <Button asChild className="gap-2 shrink-0">
                        <Link href={`/events/${event.id}`}>
                          Check-in
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
