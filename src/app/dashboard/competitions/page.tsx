"use client"

import * as React from "react"
import Link from "next/link"
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
import {
  Plus, Search, CalendarDays, Clock, MapPin, Trophy, Loader2, AlertCircle, Users, Trash2, Radio, Settings,
} from "lucide-react"
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns"
import { toast } from "sonner"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { CompetitionConfiguration } from "./competition-configuration"

const COMPETITION_TYPE_LABELS: Record<string, string> = {
  GYMNASTICS: "Gymnastics",
  TRACK_AND_FIELD: "Track & Field",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  REGISTRATION_OPEN: "default",
  PUBLISHED: "default",
  DRAFT: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
}

const STATUS_LABELS: Record<string, string> = {
  REGISTRATION_OPEN: "Open",
  PUBLISHED: "Published",
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
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

interface Competition {
  id: string
  name: string
  competitionType: string
  status: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  city?: string | null
  stateProvince?: string | null
  pricingMode: string
  entryFee?: number | string | null
  publishStatus?: string | null
  scheduledGoLiveDate?: string | null
  scheduledGoLiveTime?: string | null
  facility?: { id: string; name: string; city?: string | null; stateProvince?: string | null } | null
  _count?: { entries: number; results: number; teams: number }
  categories?: any[]
}

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = React.useState<Competition[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [selectedCompetition, setSelectedCompetition] = React.useState<Competition | null>(null)

  const fetchCompetitions = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/competitions")
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch competitions")
      }
      const data = await response.json()
      setCompetitions(data)
    } catch (err) {
      console.error("Failed to fetch competitions:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch competitions")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCompetitions()
  }, [fetchCompetitions])

  const handleDelete = async (competition: Competition) => {
    setDeletingId(competition.id)
    try {
      const response = await fetch(`/api/competitions/${competition.id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete competition")
      }
      toast.success(`"${competition.name}" deleted`)
      setCompetitions((prev) => prev.filter((c) => c.id !== competition.id))
    } catch (err) {
      console.error("Failed to delete competition:", err)
      toast.error(err instanceof Error ? err.message : "Failed to delete competition")
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditCompetition = (competition: Competition) => {
    setSelectedCompetition(competition)
    setIsEditOpen(true)
  }

  const filtered = React.useMemo(() => {
    if (!searchTerm.trim()) return competitions
    const term = searchTerm.toLowerCase()
    return competitions.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.competitionType.toLowerCase().includes(term) ||
        c.city?.toLowerCase().includes(term) ||
        c.facility?.name.toLowerCase().includes(term)
    )
  }, [competitions, searchTerm])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Competitions</h1>
          <p className="text-muted-foreground">
            Manage competitions, meets, and large-scale events.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/competitions/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Competition
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search competitions..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading && competitions.length === 0 && (
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

      <Sheet
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            setSelectedCompetition(null)
          }
        }}
      >
        <SheetContent className="sm:max-w-2xl p-0">
          {selectedCompetition ? (
            <CompetitionConfiguration
              competitionId={selectedCompetition.id}
              onClose={() => {
                setIsEditOpen(false)
                setSelectedCompetition(null)
              }}
              onUpdated={async () => {
                await fetchCompetitions()
              }}
            />
          ) : (
            <div className="p-6">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {!isLoading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((competition) => {
            const location = competition.facility
              ? `${competition.facility.name}${competition.facility.city ? `, ${competition.facility.city}` : ""}`
              : [competition.city, competition.stateProvince].filter(Boolean).join(", ")
            const entryCount = competition._count?.entries ?? 0
            const categoryCount = competition.categories?.length ?? 0
            const isDraft = competition.status === "DRAFT"

            // Registration timing info
            const isOpen = competition.status === "REGISTRATION_OPEN"
            const startDate = new Date(competition.startDate)
            const hasScheduledGoLive = competition.publishStatus === "SCHEDULED" && competition.scheduledGoLiveDate
            const scheduledDate = hasScheduledGoLive ? new Date(competition.scheduledGoLiveDate!) : null

            return (
              <Card key={competition.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 min-w-0">
                      <CardTitle className="leading-tight">{competition.name}</CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant={STATUS_VARIANTS[competition.status] || "secondary"}
                        className="text-[10px]"
                      >
                        {STATUS_LABELS[competition.status] || competition.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {COMPETITION_TYPE_LABELS[competition.competitionType] || competition.competitionType}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <div className="space-y-1.5">
                    {/* Dates */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>
                        {format(startDate, "MMM d, yyyy")}
                        {competition.endDate && competition.endDate !== competition.startDate && (
                          <> &ndash; {format(new Date(competition.endDate), "MMM d, yyyy")}</>
                        )}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{competition.startTime} &ndash; {competition.endTime}</span>
                    </div>

                    {/* Location */}
                    {location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{location}</span>
                      </div>
                    )}

                    {/* Price */}
                    {competition.pricingMode !== "FREE" && (
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <span className="text-muted-foreground">$</span>
                        <span>{formatPrice(competition.entryFee)}</span>
                      </div>
                    )}

                    {/* Scheduled go-live for non-open competitions */}
                    {!isOpen && scheduledDate && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Radio className="h-3.5 w-3.5 text-amber-500" />
                        {isFuture(scheduledDate) ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            Goes live {formatDistanceToNow(scheduledDate, { addSuffix: true })}
                            {competition.scheduledGoLiveTime && ` at ${competition.scheduledGoLiveTime}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Was scheduled for {format(scheduledDate, "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Registration closes when event starts — show for open competitions */}
                    {isOpen && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Radio className="h-3.5 w-3.5 text-green-500" />
                        {isFuture(startDate) ? (
                          <span className="text-green-600 dark:text-green-400">
                            Registration closes {formatDistanceToNow(startDate, { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Registration closed {format(startDate, "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {categoryCount > 0 && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-full">
                        <Trophy className="h-3 w-3" />
                        {categoryCount} {categoryCount === 1 ? "category" : "categories"}
                      </div>
                    )}
                    {entryCount > 0 && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                        <Users className="h-3 w-3" />
                        {entryCount} {entryCount === 1 ? "entry" : "entries"}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-3 gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/dashboard/competitions/${competition.id}`}>
                      View Details
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEditCompetition(competition)}
                    title="Edit competition"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  {isDraft && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === competition.id}
                        >
                          {deletingId === competition.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete competition?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &ldquo;{competition.name}&rdquo;. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(competition)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardFooter>
              </Card>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
              <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No competitions match your search." : "No competitions yet. Create one to get started."}
              </p>
              {!searchTerm && (
                <Button variant="outline" asChild>
                  <Link href="/dashboard/competitions/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first competition
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
