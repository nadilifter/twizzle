"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { format, isPast } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  CalendarDays,
  Clock,
  MapPin,
  Trophy,
  BarChart3,
  Settings,
  DollarSign,
  Info,
  UserCheck,
  Flag,
  Receipt,
  ArrowRight,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useBreadcrumbOverride } from "@/components/breadcrumb-context"
// Timeline is rendered inline in the Overview tab
import { CompetitionConfiguration } from "../competition-configuration"
import {
  COMPETITION_TYPE_LABELS,
  getStatusLabel,
  getStatusStyle,
} from "../lib/competition-status"
import { AthletesTab } from "./athletes-tab"
import { EventsTab, getCategoryLabel } from "./events-tab"
import { TransactionsTab } from "./transactions-tab"

interface CompetitionCategory {
  id: string
  resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE"
  sortDirection: "ASC" | "DESC"
  precision: number
  seedMarkRequired: boolean
  isTeamEvent: boolean
  teamSize: number | null
  price: string | number | null
  isActive: boolean
  displayOrder: number
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
  sportEvent: { id: string; name: string; code: string } | null
  ageCategory: { id: string; name: string; code: string } | null
  _count: { entries: number; results: number }
}

interface CompetitionLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: string | number
  total: string | number
  createdAt: string
  invoice: {
    id: string
    reference: string
    status: string
    total: string | number
    createdAt: string
    family: { id: string; name: string; primaryContact: string } | null
  }
}

interface CompetitionDetail {
  id: string
  name: string
  competitionType: string
  status: string
  publishStatus: string | null
  scheduledGoLiveDate: string | null
  scheduledGoLiveTime: string | null
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  city: string | null
  stateProvince: string | null
  streetAddress: string | null
  postalCode: string | null
  country: string | null
  pricingMode: string
  entryFee: number | string | null
  createdAt: string
  facility: { id: string; name: string; street: string | null; city: string | null; stateProvince: string | null; postalCode: string | null } | null
  categories: CompetitionCategory[]
  entries: {
    id: string
    createdAt: string
    athlete: {
      id: string
      firstName: string | null
      lastName: string | null
      name: string | null
      familyId: string | null
      family: { id: string; name: string; email: string; primaryContact: string } | null
    }
  }[]
  lineItems: CompetitionLineItem[]
  _count: { entries: number; results: number; teams: number }
  hasLevelRestriction: boolean
  hasMembershipRestriction: boolean
  hasWaiverRestriction: boolean
  hasMedicalRequirement: boolean
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

interface LatestRegistration {
  athleteId: string
  athleteName: string
  familyName: string | null
  registeredAt: string
}

function getLatestRegistrations(competition: CompetitionDetail): LatestRegistration[] {
  const seen = new Map<string, LatestRegistration>()
  for (const entry of competition.entries) {
    const athlete = entry.athlete
    if (seen.has(athlete.id)) continue
    seen.set(athlete.id, {
      athleteId: athlete.id,
      athleteName: [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || athlete.name || "Unknown athlete",
      familyName: athlete.family?.name ?? null,
      registeredAt: entry.createdAt,
    })
  }
  return Array.from(seen.values())
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

const PRICING_MODE_LABELS: Record<string, string> = {
  FREE: "Free",
  PER_COMPETITION: "Per Competition",
  PER_EVENT: "Per Event",
  TIERED: "Tiered",
  PER_CATEGORY: "Per Category",
}

const INVOICE_STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  DRAFT: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  PARTIAL: "bg-yellow-50 text-yellow-700 border-yellow-200",
}

function buildTimelineItems(competition: CompetitionDetail) {
  const items: {
    title: string
    date: Date | null
    time: string | null
    hollow: boolean
  }[] = []

  items.push({
    title: "Registration Created",
    date: new Date(competition.createdAt),
    time: format(new Date(competition.createdAt), "h:mm a"),
    hollow: false,
  })

  const hasGoneLive =
    competition.publishStatus === "LIVE" ||
    competition.publishStatus === "CLOSED" ||
    competition.publishStatus === "COMPLETED" ||
    competition.status === "REGISTRATION_OPEN" ||
    competition.status === "REGISTRATION_CLOSED" ||
    competition.status === "IN_PROGRESS" ||
    competition.status === "COMPLETED"

  if (hasGoneLive) {
    const goLiveDate = competition.scheduledGoLiveDate
      ? new Date(competition.scheduledGoLiveDate)
      : null
    items.push({
      title: "Registration Live",
      date: goLiveDate,
      time: competition.scheduledGoLiveTime ?? null,
      hollow: false,
    })
  } else if (competition.publishStatus === "SCHEDULED" && competition.scheduledGoLiveDate) {
    items.push({
      title: "Registration Scheduled to Go Live",
      date: new Date(competition.scheduledGoLiveDate),
      time: competition.scheduledGoLiveTime ?? null,
      hollow: true,
    })
  }

  const hasClosed =
    competition.status === "REGISTRATION_CLOSED" ||
    competition.status === "IN_PROGRESS" ||
    competition.status === "COMPLETED" ||
    competition.publishStatus === "CLOSED" ||
    competition.publishStatus === "COMPLETED"

  if (hasClosed) {
    items.push({
      title: "Registration Closed",
      date: null,
      time: null,
      hollow: false,
    })
  }

  const startDate = new Date(competition.startDate)
  const startPast = isPast(startDate)
  items.push({
    title: "Competition Begins",
    date: startDate,
    time: competition.startTime,
    hollow: !startPast,
  })

  const endDate = new Date(competition.endDate)
  const endPast = isPast(endDate)
  items.push({
    title: "Competition Ends",
    date: endDate,
    time: competition.endTime,
    hollow: !endPast,
  })

  return items
}

export default function CompetitionProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const competitionId = params.id as string

  const [competition, setCompetition] = React.useState<CompetitionDetail | null>(null)
  const [results, setResults] = React.useState<CompetitionResult[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all")
  const [loading, setLoading] = React.useState(true)
  const [resultsLoading, setResultsLoading] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [activeTab, setActiveTabState] = React.useState(searchParams.get("tab") ?? "overview")

  const setActiveTab = React.useCallback((tab: string) => {
    setActiveTabState(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "overview") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const qs = params.toString()
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  }, [searchParams, router])

  useBreadcrumbOverride(
    competition ? `/dashboard/competitions/${competitionId}` : undefined,
    competition?.name,
  )

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
        <Skeleton className="h-10 w-full max-w-lg" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 md:col-span-2" />
        </div>
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

  const facilityName = competition.facility?.name ?? null
  const locationAddress = competition.facility
    ? [competition.facility.street, competition.facility.city, [competition.facility.stateProvince, competition.facility.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : [competition.streetAddress, competition.city, [competition.stateProvince, competition.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")

  const selectedCategory =
    selectedCategoryId === "all"
      ? null
      : competition.categories.find((category) => category.id === selectedCategoryId) || null

  const categoryFilter = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="w-full sm:max-w-[280px]">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {competition.categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {getCategoryLabel(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  const latestRegistrations = getLatestRegistrations(competition)
  const timelineItems = buildTimelineItems(competition)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{competition.name}</h1>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0",
              getStatusStyle(competition),
            )}
          >
            {getStatusLabel(competition)}
          </Badge>
        </div>
        <Button onClick={() => setIsEditOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
          <CompetitionConfiguration
            competitionId={competitionId}
            onClose={() => setIsEditOpen(false)}
            onUpdated={async () => {}}
          />
        </SheetContent>
      </Sheet>

      {/* Top-level tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Info className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="athletes" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Athletes
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Flag className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <Receipt className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <Trophy className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left column */}
            <div className="space-y-6">
              {/* Competition Info Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-around text-center border-b pb-4 mb-4">
                    <div>
                      <p className="text-2xl font-bold">{competition._count.entries}</p>
                      <p className="text-xs text-muted-foreground">Entries</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{competition._count.results}</p>
                      <p className="text-xs text-muted-foreground">Results</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{competition.categories.length}</p>
                      <p className="text-xs text-muted-foreground">Categories</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Trophy className="h-4 w-4 shrink-0" />
                      <span>{COMPETITION_TYPE_LABELS[competition.competitionType] || competition.competitionType}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span>
                        {format(new Date(competition.startDate), "MMM d, yyyy")}
                        {competition.endDate && competition.endDate !== competition.startDate && (
                          <> &ndash; {format(new Date(competition.endDate), "MMM d, yyyy")}</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{competition.startTime} &ndash; {competition.endTime}</span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      {facilityName || locationAddress ? (
                        <div>
                          {facilityName && <span className="font-medium text-foreground">{facilityName}</span>}
                          {facilityName && locationAddress && <br />}
                          {locationAddress && <span>{locationAddress}</span>}
                        </div>
                      ) : (
                        <span>No location set</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4 shrink-0" />
                      <span>
                        {competition.pricingMode === "FREE"
                          ? "Free"
                          : `${formatPrice(competition.entryFee)} (${PRICING_MODE_LABELS[competition.pricingMode] || competition.pricingMode})`}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Events Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Events</CardTitle>
                  {competition.categories.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setActiveTab("events")}
                    >
                      View All
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {competition.categories.length > 0 ? (
                    <div className="space-y-3">
                      {competition.categories.slice(0, 5).map((category) => (
                        <div key={category.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Flag className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <p className="text-sm font-medium truncate">
                              {getCategoryLabel(category)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 ml-2">
                            {category._count.entries} {category._count.entries === 1 ? "entry" : "entries"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No events configured yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="md:col-span-2 space-y-6">
              {/* Registration Timeline Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Registration Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {timelineItems.map((item, idx) => {
                      const isLast = idx === timelineItems.length - 1
                      return (
                        <div key={idx} className="relative flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                "h-3 w-3 rounded-full border-2 shrink-0 mt-1.5",
                                item.hollow
                                  ? "bg-background border-muted-foreground/40"
                                  : "bg-primary border-primary",
                              )}
                            />
                            {!isLast && (
                              <div className="w-[2px] flex-1 bg-border my-1" />
                            )}
                          </div>
                          <div className={cn("pb-5", isLast && "pb-0")}>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold">{item.title}</h4>
                              {item.hollow && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                  Upcoming
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.date
                                ? `${format(item.date, "MMMM d, yyyy")}${item.time ? ` at ${item.time}` : ""}`
                                : "Date pending"}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Transaction History + Latest Registrations side by side */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Transaction History Card (latest 5) */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Transaction History</CardTitle>
                    {competition.lineItems && competition.lineItems.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => setActiveTab("transactions")}
                      >
                        View All
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {competition.lineItems && competition.lineItems.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {competition.lineItems.slice(0, 5).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <p className="font-medium">{item.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.invoice?.family?.name ?? "N/A"} &middot; {format(new Date(item.createdAt), "MM/dd/yyyy")}
                                </p>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "capitalize",
                                    INVOICE_STATUS_STYLES[item.invoice?.status] ?? "",
                                  )}
                                >
                                  {item.invoice?.status?.toLowerCase() ?? "unknown"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatPrice(item.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-10 text-center text-muted-foreground">
                        No transactions found.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Latest Registrations Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Latest Registrations</CardTitle>
                    {latestRegistrations.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => setActiveTab("athletes")}
                      >
                        View All
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {latestRegistrations.length > 0 ? (
                      <div className="space-y-4">
                        {latestRegistrations.slice(0, 5).map((reg) => (
                          <div
                            key={reg.athleteId}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback>
                                  {reg.athleteName
                                    .split(" ")
                                    .map((w) => w[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{reg.athleteName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {reg.familyName && <>{reg.familyName} &middot; </>}
                                  {format(new Date(reg.registeredAt), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/competitions/${competition.id}/athletes/${reg.athleteId}`}>
                                View
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-muted-foreground">
                        No athletes registered yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== RESULTS TAB ===== */}
        <TabsContent value="results">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Results</CardTitle>
                  <CardDescription className="mt-1">
                    {results.length} result{results.length === 1 ? "" : "s"} recorded
                  </CardDescription>
                </div>
                {categoryFilter}
              </div>
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

        {/* ===== TRANSACTIONS TAB ===== */}
        <TabsContent value="transactions">
          <TransactionsTab lineItems={competition.lineItems} />
        </TabsContent>

        {/* ===== REPORTS TAB (placeholder) ===== */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Competition analytics and reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Coming Soon</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Competition reports and analytics will be available here, including entry summaries, result breakdowns, and participation trends.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ATHLETES TAB ===== */}
        <TabsContent value="athletes">
          <AthletesTab competitionId={competitionId} />
        </TabsContent>

        {/* ===== EVENTS TAB (placeholder) ===== */}
        <TabsContent value="events">
          <EventsTab
            categories={competition.categories}
            pricingMode={competition.pricingMode}
            competitionId={competitionId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
