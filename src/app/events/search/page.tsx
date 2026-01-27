"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  ArrowLeft, 
  Search,
  Check,
  Clock4,
  Loader2,
  UserSearch,
  Calendar,
  UserCheck
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { useAthletes } from "@/hooks/use-athletes"
import { useEvents } from "@/hooks/use-events"
import { useAttendance } from "@/hooks/use-attendance"
import { toast } from "sonner"

function getInitials(name: string) {
  const parts = name.split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

export default function AthleteSearchPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)
  const [processingEventId, setProcessingEventId] = useState<string | null>(null)
  
  // Track last fetched values to prevent infinite loops
  const lastFetchedSearch = useRef<string>("")
  const lastFetchedAthleteId = useRef<string | null>(null)
  const hasFetchedEvents = useRef(false)
  
  const { athletes, fetchAthletes, isLoading: athletesLoading } = useAthletes({ autoFetch: false })
  const { events, fetchEvents, isLoading: eventsLoading } = useEvents({ autoFetch: false })
  const { markAttendance, fetchAttendance, attendances, isUpdating } = useAttendance({ autoFetch: false })

  // Fetch today's events on mount (only once)
  useEffect(() => {
    if (hasFetchedEvents.current) return
    hasFetchedEvents.current = true
    const today = format(new Date(), "yyyy-MM-dd")
    fetchEvents({ startDate: today, endDate: today })
  }, [fetchEvents])

  // Debounced search for athletes
  useEffect(() => {
    const trimmedQuery = searchQuery.trim()
    
    // Skip if query hasn't changed or is too short
    if (trimmedQuery.length < 2 || trimmedQuery === lastFetchedSearch.current) {
      return
    }
    
    const timer = setTimeout(() => {
      lastFetchedSearch.current = trimmedQuery
      fetchAthletes({ search: trimmedQuery })
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchQuery, fetchAthletes])

  // Fetch attendance for selected athlete
  useEffect(() => {
    if (selectedAthleteId && selectedAthleteId !== lastFetchedAthleteId.current) {
      lastFetchedAthleteId.current = selectedAthleteId
      fetchAttendance({ athleteId: selectedAthleteId })
    }
  }, [selectedAthleteId, fetchAttendance])

  // Filter athletes by search
  const filteredAthletes = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return []
    return athletes
  }, [athletes, searchQuery])

  // Get athlete's registrations for today's events
  const athleteRegistrations = useMemo(() => {
    if (!selectedAthleteId) return []
    
    return events.map(event => {
      const attendance = attendances.find(
        a => a.eventId === event.id && a.athleteId === selectedAthleteId
      )
      return {
        event,
        attendance,
        isRegistered: !!attendance,
        isCheckedIn: attendance?.status === "PRESENT" || attendance?.status === "LATE"
      }
    })
  }, [events, attendances, selectedAthleteId])

  const selectedAthlete = useMemo(() => {
    return athletes.find(a => a.id === selectedAthleteId)
  }, [athletes, selectedAthleteId])

  const handleCheckin = useCallback(async (eventId: string, status: "PRESENT" | "LATE") => {
    if (!selectedAthleteId) return
    
    setProcessingEventId(eventId)
    
    const result = await markAttendance({
      athleteId: selectedAthleteId,
      eventId,
      status
    })
    
    if (result) {
      toast.success(`Checked in as ${status.toLowerCase()}`)
      // Reset ref to allow refetching attendance
      lastFetchedAthleteId.current = null
      fetchAttendance({ athleteId: selectedAthleteId })
      lastFetchedAthleteId.current = selectedAthleteId
    } else {
      toast.error("Failed to check in")
    }
    
    setProcessingEventId(null)
  }, [selectedAthleteId, markAttendance, fetchAttendance])

  const clearSelection = useCallback(() => {
    setSelectedAthleteId(null)
    setSearchQuery("")
    lastFetchedSearch.current = ""
    lastFetchedAthleteId.current = null
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/events">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Athlete Search</h1>
          <p className="text-muted-foreground">Find and check in athletes manually</p>
        </div>
      </div>

      {/* Search Input */}
      {!selectedAthleteId && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by athlete name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-lg h-12"
                autoFocus
              />
            </div>
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <p className="text-sm text-muted-foreground mt-2">
                Enter at least 2 characters to search
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {athletesLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Search Results */}
      {!selectedAthleteId && !athletesLoading && filteredAthletes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserSearch className="h-5 w-5" />
              Search Results ({filteredAthletes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredAthletes.map((athlete) => (
                <button
                  key={athlete.id}
                  onClick={() => setSelectedAthleteId(athlete.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={athlete.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(athlete.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{athlete.name}</p>
                    {athlete.email && (
                      <p className="text-sm text-muted-foreground">{athlete.email}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!selectedAthleteId && !athletesLoading && searchQuery.trim().length >= 2 && filteredAthletes.length === 0 && (
        <Card className="p-8 text-center">
          <UserSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Athletes Found</h3>
          <p className="text-muted-foreground">
            No athletes match &quot;{searchQuery}&quot;
          </p>
        </Card>
      )}

      {/* Selected Athlete View */}
      {selectedAthleteId && selectedAthlete && (
        <>
          {/* Athlete Header */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedAthlete.avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                      {getInitials(selectedAthlete.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{selectedAthlete.name}</h2>
                    {selectedAthlete.email && (
                      <p className="text-sm text-muted-foreground">{selectedAthlete.email}</p>
                    )}
                  </div>
                </div>
                <Button variant="outline" onClick={clearSelection}>
                  Search Again
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Today's Events */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Today&apos;s Events
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {eventsLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : athleteRegistrations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No events scheduled for today
                </div>
              ) : (
                <div className="divide-y">
                  {athleteRegistrations.map(({ event, attendance, isRegistered, isCheckedIn }) => {
                    const isProcessing = processingEventId === event.id
                    
                    return (
                      <div 
                        key={event.id}
                        className={`p-4 ${isCheckedIn ? "bg-green-50/50 dark:bg-green-950/30" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm text-muted-foreground">
                                {event.startTime}
                              </span>
                              {event.type && (
                                <Badge variant="secondary" className="text-xs">
                                  {event.type}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold">{event.title}</h3>
                            {isRegistered && (
                              <Badge 
                                variant="outline" 
                                className={`mt-2 ${
                                  isCheckedIn 
                                    ? "bg-green-100 text-green-700 border-green-300" 
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
                                {isCheckedIn 
                                  ? `Checked in at ${attendance?.checkedIn ? format(new Date(attendance.checkedIn), "h:mm a") : ""}` 
                                  : "Registered"
                                }
                              </Badge>
                            )}
                          </div>
                          
                          {isCheckedIn ? (
                            <div className="flex items-center gap-2 text-green-600 shrink-0">
                              <UserCheck className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                                onClick={() => handleCheckin(event.id, "LATE")}
                                disabled={isProcessing || isUpdating}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Clock4 className="h-4 w-4" />
                                )}
                                Late
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1 bg-green-600 hover:bg-green-700"
                                onClick={() => handleCheckin(event.id, "PRESENT")}
                                disabled={isProcessing || isUpdating}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                Check In
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
