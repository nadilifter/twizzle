"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  formatSeedMarkForDisplay,
  type SeedMarkFields,
  type ResultType as AthleticsResultType,
} from "@/lib/athletics-formats"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Trophy,
  BarChart3,
  Settings,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { CompetitionConfiguration } from "../competition-configuration"

interface CompetitionCategory {
  id: string
  resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE"
  sortDirection: "ASC" | "DESC"
  precision: number
  combinationEntry: {
    id: string
    rowValue: { id: string; name: string }
    colValue: { id: string; name: string }
    template: { id: string; name: string }
  } | null
  individualEntry: {
    id: string
    name: string
    template: { id: string; name: string }
  } | null
  _count: { entries: number; results: number }
}

interface CompetitionDetail {
  id: string
  name: string
  competitionType: string
  status: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  city: string | null
  stateProvince: string | null
  pricingMode: string
  entryFee: number | string | null
  facility: { id: string; name: string; city: string | null; stateProvince: string | null } | null
  categories: CompetitionCategory[]
  _count: { entries: number; results: number; teams: number }
}

interface CompetitionEntry {
  id: string
  status: string
  seedHours: number | null
  seedMinutes: number | null
  seedSeconds: number | null
  seedMs: number | null
  seedHandTimed: boolean
  seedDistance: number | null
  seedPoints: number | null
  seedPlacement: string | null
  athlete: {
    id: string
    firstName: string | null
    lastName: string | null
    name: string | null
  }
  category: {
    id: string
    resultType: string
  }
}

interface CompetitionResult {
  id: string
  value: number
  displayValue: string | null
  placement: number | null
  isDNF: boolean
  isDNS: boolean
  isDQ: boolean
  athlete: {
    id: string
    firstName: string | null
    lastName: string | null
    name: string | null
  } | null
  team: {
    id: string
    name: string
  } | null
  category: {
    id: string
    resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE" | "PLACEMENT"
    sortDirection: "ASC" | "DESC"
    precision: number
  }
}

function getCategoryLabel(category: CompetitionCategory, index: number): string {
  if (category.individualEntry?.name) {
    return category.individualEntry.name
  }
  if (category.combinationEntry) {
    return `${category.combinationEntry.rowValue.name} - ${category.combinationEntry.colValue.name}`
  }
  return `Category ${index + 1}`
}

function formatResultValue(value: number, resultType: string, precision: number): string {
  if (resultType === "TIME") {
    const totalMs = Math.round(value)
    const minutes = Math.floor(totalMs / 60000)
    const seconds = Math.floor((totalMs % 60000) / 1000)
    const ms = totalMs % 1000
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`
    }
    return `${seconds}.${ms.toString().padStart(3, "0")}s`
  }

  if (resultType === "DISTANCE" || resultType === "HEIGHT") {
    const meters = value / 1000
    return `${meters.toFixed(precision)}m`
  }

  return value.toFixed(precision)
}

export default function CompetitionProfilePage() {
  const params = useParams()
  const competitionId = params.id as string

  const [competition, setCompetition] = React.useState<CompetitionDetail | null>(null)
  const [entries, setEntries] = React.useState<CompetitionEntry[]>([])
  const [results, setResults] = React.useState<CompetitionResult[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all")
  const [entryStatus, setEntryStatus] = React.useState<string>("all")
  const [loading, setLoading] = React.useState(true)
  const [entriesLoading, setEntriesLoading] = React.useState(false)
  const [resultsLoading, setResultsLoading] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)

  React.useEffect(() => {
    const fetchCompetition = async () => {
      try {
        const response = await fetch(`/api/competitions/${competitionId}`)
        if (!response.ok) throw new Error("Failed to fetch competition")
        const data = await response.json()
        setCompetition(data)
      } catch (error) {
        toast.error("Failed to load competition details")
      } finally {
        setLoading(false)
      }
    }

    if (competitionId) fetchCompetition()
  }, [competitionId, isEditOpen])

  React.useEffect(() => {
    if (!competition) return
    if (competition.categories.length > 0) {
      setSelectedCategoryId(competition.categories[0].id)
    } else {
      setSelectedCategoryId("all")
    }
  }, [competition])

  React.useEffect(() => {
    const fetchEntries = async () => {
      setEntriesLoading(true)
      try {
        const url = new URL(`/api/competitions/${competitionId}/entries`, window.location.origin)
        if (selectedCategoryId !== "all") {
          url.searchParams.set("categoryId", selectedCategoryId)
        }
        if (entryStatus !== "all") {
          url.searchParams.set("status", entryStatus)
        }

        const response = await fetch(url.toString())
        if (!response.ok) throw new Error("Failed to fetch registrations")
        const data = await response.json()
        setEntries(data)
      } catch (error) {
        toast.error("Failed to load registrations")
      } finally {
        setEntriesLoading(false)
      }
    }

    fetchEntries()
  }, [competitionId, selectedCategoryId, entryStatus])

  React.useEffect(() => {
    const fetchResults = async () => {
      setResultsLoading(true)
      try {
        const url = new URL(`/api/competitions/${competitionId}/results`, window.location.origin)
        if (selectedCategoryId !== "all") {
          url.searchParams.set("categoryId", selectedCategoryId)
        }

        const response = await fetch(url.toString())
        if (!response.ok) throw new Error("Failed to fetch results")
        const data = await response.json()
        setResults(data)
      } catch (error) {
        toast.error("Failed to load results")
      } finally {
        setResultsLoading(false)
      }
    }

    fetchResults()
  }, [competitionId, selectedCategoryId])

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">Competition not found</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/competitions">Back to competitions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const location = competition.facility
    ? `${competition.facility.name}${competition.facility.city ? `, ${competition.facility.city}` : ""}`
    : [competition.city, competition.stateProvince].filter(Boolean).join(", ")

  const selectedCategory =
    selectedCategoryId === "all"
      ? null
      : competition.categories.find((category) => category.id === selectedCategoryId) || null

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/competitions">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{competition.name}</h1>
              <Badge>{competition.status}</Badge>
            </div>
            <p className="text-muted-foreground">
              Competition profile with registrations, results, and event configuration details.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsEditOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Edit Competition
        </Button>
      </div>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
          <CompetitionConfiguration
            competitionId={competitionId}
            onClose={() => setIsEditOpen(false)}
            onUpdated={async () => {
              // Re-fetch is triggered by dependency on isEditOpen
            }}
          />
        </SheetContent>
      </Sheet>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competition._count.entries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competition._count.results}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competition.categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competition._count.teams}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competition Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-2">
              <CalendarDays className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">Dates</div>
                <div className="text-muted-foreground">
                  {format(new Date(competition.startDate), "MMM d, yyyy")}
                  {competition.endDate && competition.endDate !== competition.startDate && (
                    <> - {format(new Date(competition.endDate), "MMM d, yyyy")}</>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">Time</div>
                <div className="text-muted-foreground">
                  {competition.startTime} - {competition.endTime}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">Location</div>
                <div className="text-muted-foreground">{location || "No location set"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-md">
          <label className="text-sm text-muted-foreground">Category</label>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {competition.categories.map((category, index) => (
                <SelectItem key={category.id} value={category.id}>
                  {getCategoryLabel(category, index)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <label className="text-sm text-muted-foreground">Registration Status</label>
          <Select value={entryStatus} onValueChange={setEntryStatus}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING_SEED">Pending Seed</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="registrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="registrations" className="gap-2">
            <Users className="h-4 w-4" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <Trophy className="h-4 w-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            More
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrations">
          <Card>
            <CardHeader>
              <CardTitle>Registrations</CardTitle>
              <CardDescription>
                {entries.length} registration{entries.length === 1 ? "" : "s"}
                {selectedCategory ? ` in ${getCategoryLabel(selectedCategory, 0)}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {entriesLoading ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : entries.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  No registrations found for this selection.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result Type</TableHead>
                      <TableHead>Seed Mark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {[
                            entry.athlete.firstName,
                            entry.athlete.lastName,
                          ].filter(Boolean).join(" ") || entry.athlete.name || "Unknown athlete"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.status}</Badge>
                        </TableCell>
                        <TableCell>{entry.category?.resultType || "-"}</TableCell>
                        <TableCell>
                          {formatSeedMarkForDisplay(
                            {
                              seedHours: entry.seedHours,
                              seedMinutes: entry.seedMinutes,
                              seedSeconds: entry.seedSeconds,
                              seedMs: entry.seedMs,
                              seedHandTimed: entry.seedHandTimed,
                              seedDistance: entry.seedDistance,
                              seedPoints: entry.seedPoints,
                              seedPlacement: entry.seedPlacement,
                            } as SeedMarkFields,
                            (entry.category?.resultType ?? "TIME") as AthleticsResultType,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {results.length} result{results.length === 1 ? "" : "s"} recorded
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {resultsLoading ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  No results found for this selection.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placement</TableHead>
                      <TableHead>Athlete / Team</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => {
                      const name = result.athlete
                        ? [result.athlete.firstName, result.athlete.lastName].filter(Boolean).join(" ") ||
                          result.athlete.name ||
                          "Unknown athlete"
                        : result.team?.name || "Unknown team"

                      return (
                        <TableRow key={result.id}>
                          <TableCell>{result.placement || index + 1}</TableCell>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            {result.isDNF || result.isDNS || result.isDQ
                              ? "-"
                              : formatResultValue(
                                  Number(result.value),
                                  result.category.resultType,
                                  result.category.precision
                                )}
                          </TableCell>
                          <TableCell>
                            {result.isDNF && <Badge variant="destructive">DNF</Badge>}
                            {result.isDNS && <Badge variant="destructive">DNS</Badge>}
                            {result.isDQ && <Badge variant="destructive">DQ</Badge>}
                            {!result.isDNF && !result.isDNS && !result.isDQ && (
                              <Badge variant="outline">Valid</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Competition Overview</CardTitle>
              <CardDescription>
                Additional context and setup details for this competition.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-medium">Type:</span> {competition.competitionType}</p>
              <p><span className="font-medium">Pricing Mode:</span> {competition.pricingMode}</p>
              <p>
                <span className="font-medium">Entry Fee:</span>{" "}
                {competition.entryFee === null || competition.entryFee === undefined
                  ? "Free / N/A"
                  : `$${Number(competition.entryFee).toFixed(2)}`}
              </p>
              <p><span className="font-medium">Configured Categories:</span> {competition.categories.length}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
