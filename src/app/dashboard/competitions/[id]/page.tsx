"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { LocationMap } from "@/components/location-map";
import { RegistrationTimeline, type TimelineItem } from "@/components/registration-timeline";
import { TransactionHistoryCard } from "@/components/transaction-history-card";
import { LatestRegistrationsCard } from "@/components/latest-registrations-card";
import { formatPrice } from "@/lib/format-utils";
import { CompetitionConfiguration } from "../competition-configuration";
import { CssExportDialog } from "./css-export-dialog";
import { getStatusLabel, getStatusStyle } from "../lib/competition-status";
import { AthletesTab } from "./athletes-tab";
import { EventsTab, getCategoryLabel } from "./events-tab";
import { TransactionsTab } from "./transactions-tab";
import { formatTime12h } from "@/lib/date-utils";

interface CompetitionCategory {
  id: string;
  resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE";
  sortDirection: "ASC" | "DESC";
  precision: number;
  seedMarkRequired: boolean;
  isTeamEvent: boolean;
  teamSize: number | null;
  price: string | number | null;
  isActive: boolean;
  displayOrder: number;
  combinationEntry: {
    id: string;
    rowValue: { id: string; name: string };
    colValue: { id: string; name: string };
    template: { id: string; name: string };
  } | null;
  individualEntry: {
    id: string;
    name: string;
    template: { id: string; name: string };
  } | null;
  sportEvent: { id: string; name: string; code: string } | null;
  ageCategory: { id: string; name: string; code: string } | null;
  _count: { entries: number; results: number };
}

interface CompetitionLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  createdAt: string;
  invoice: {
    id: string;
    reference: string;
    status: string;
    total: string | number;
    createdAt: string;
    user: { id: string; name: string; email: string } | null;
  };
}

interface CompetitionDetail {
  id: string;
  name: string;
  status: string;
  publishStatus: string | null;
  scheduledGoLiveDate: string | null;
  scheduledGoLiveTime: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  city: string | null;
  stateProvince: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  country: string | null;
  pricingMode: string;
  entryFee: number | string | null;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  facility: {
    id: string;
    name: string;
    street: string | null;
    city: string | null;
    stateProvince: string | null;
    postalCode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  categories: CompetitionCategory[];
  entries: {
    id: string;
    createdAt: string;
    athlete: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    };
  }[];
  lineItems: CompetitionLineItem[];
  _count: { entries: number; results: number; teams: number };
  hasLevelRestriction: boolean;
  hasMembershipRestriction: boolean;
  hasWaiverRestriction: boolean;
  hasMedicalRequirement: boolean;
}

interface CompetitionResult {
  id: string;
  value: number;
  displayValue: string | null;
  placement: number | null;
  isDNF: boolean;
  isDNS: boolean;
  isDQ: boolean;
  athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE" | "PLACEMENT";
    sortDirection: "ASC" | "DESC";
    precision: number;
  };
}

interface LatestRegistration {
  athleteId: string;
  athleteName: string;
  athleteAvatar: string | null;
  registeredAt: string;
}

function getLatestRegistrations(competition: CompetitionDetail): LatestRegistration[] {
  const seen = new Map<string, LatestRegistration>();
  for (const entry of competition.entries) {
    const athlete = entry.athlete;
    if (seen.has(athlete.id)) continue;
    seen.set(athlete.id, {
      athleteId: athlete.id,
      athleteName:
        [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || "Unknown athlete",
      athleteAvatar: athlete.avatar,
      registeredAt: entry.createdAt,
    });
  }
  return Array.from(seen.values());
}

function formatResultValue(value: number, resultType: string, precision: number): string {
  if (resultType === "TIME") {
    const totalMs = Math.round(value);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
    }
    return `${seconds}.${ms.toString().padStart(3, "0")}s`;
  }

  if (resultType === "DISTANCE" || resultType === "HEIGHT") {
    const meters = value / 1000;
    return `${meters.toFixed(precision)}m`;
  }

  return value.toFixed(precision);
}

const PRICING_MODE_LABELS: Record<string, string> = {
  FREE: "Free",
  PER_COMPETITION: "Per Competition",
  PER_EVENT: "Per Event",
  TIERED: "Tiered",
  PER_CATEGORY: "Per Category",
};

function buildTimelineItems(competition: CompetitionDetail): TimelineItem[] {
  const items: TimelineItem[] = [];

  items.push({
    title: "Registration Created",
    date: new Date(competition.createdAt),
    time: format(new Date(competition.createdAt), "h:mm a"),
    hollow: false,
  });

  const hasGoneLive =
    competition.publishStatus === "LIVE" ||
    competition.publishStatus === "CLOSED" ||
    competition.publishStatus === "COMPLETED" ||
    competition.status === "REGISTRATION_OPEN" ||
    competition.status === "REGISTRATION_CLOSED" ||
    competition.status === "IN_PROGRESS" ||
    competition.status === "COMPLETED";

  if (hasGoneLive) {
    const goLiveDate = competition.scheduledGoLiveDate
      ? new Date(competition.scheduledGoLiveDate)
      : null;
    items.push({
      title: "Registration Live",
      date: goLiveDate,
      time: competition.scheduledGoLiveTime ?? null,
      hollow: false,
    });
  } else if (competition.publishStatus === "SCHEDULED" && competition.scheduledGoLiveDate) {
    items.push({
      title: "Registration Scheduled to Go Live",
      date: new Date(competition.scheduledGoLiveDate),
      time: competition.scheduledGoLiveTime ?? null,
      hollow: true,
    });
  }

  const hasClosed =
    competition.status === "REGISTRATION_CLOSED" ||
    competition.status === "IN_PROGRESS" ||
    competition.status === "COMPLETED" ||
    competition.publishStatus === "CLOSED" ||
    competition.publishStatus === "COMPLETED";

  if (hasClosed) {
    items.push({
      title: "Registration Closed",
      date: null,
      time: null,
      hollow: false,
    });
  }

  const startDate = new Date(competition.startDate);
  const startPast = isPast(startDate);
  items.push({
    title: "Competition Begins",
    date: startDate,
    time: competition.startTime,
    hollow: !startPast,
  });

  const endDate = new Date(competition.endDate);
  const endPast = isPast(endDate);
  items.push({
    title: "Competition Ends",
    date: endDate,
    time: competition.endTime,
    hollow: !endPast,
  });

  return items;
}

export default function CompetitionProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const competitionId = params.id as string;

  const [competition, setCompetition] = React.useState<CompetitionDetail | null>(null);
  const [results, setResults] = React.useState<CompetitionResult[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);
  const [resultsLoading, setResultsLoading] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isCssExportOpen, setIsCssExportOpen] = React.useState(false);
  const [activeTab, setActiveTabState] = React.useState(searchParams.get("tab") ?? "overview");

  const setActiveTab = React.useCallback(
    (tab: string) => {
      setActiveTabState(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router]
  );

  useBreadcrumbOverride(
    competition ? `/dashboard/competitions/${competitionId}` : undefined,
    competition?.name
  );

  React.useEffect(() => {
    const fetchCompetition = async () => {
      try {
        const response = await fetch(`/api/competitions/${competitionId}`);
        if (!response.ok) throw new Error("Failed to fetch competition");
        const data = await response.json();
        setCompetition(data);
      } catch (error) {
        toast.error("Failed to load competition details");
      } finally {
        setLoading(false);
      }
    };

    if (competitionId) fetchCompetition();
  }, [competitionId, isEditOpen]);

  React.useEffect(() => {
    if (!competition) return;
    if (competition.categories.length > 0) {
      setSelectedCategoryId(competition.categories[0].id);
    } else {
      setSelectedCategoryId("all");
    }
  }, [competition]);

  React.useEffect(() => {
    const fetchResults = async () => {
      setResultsLoading(true);
      try {
        const url = new URL(`/api/competitions/${competitionId}/results`, window.location.origin);
        if (selectedCategoryId !== "all") {
          url.searchParams.set("categoryId", selectedCategoryId);
        }

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Failed to fetch results");
        const data = await response.json();
        setResults(data);
      } catch (error) {
        toast.error("Failed to load results");
      } finally {
        setResultsLoading(false);
      }
    };

    fetchResults();
  }, [competitionId, selectedCategoryId]);

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
    );
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
    );
  }

  const facilityName = competition.facility?.name ?? null;
  const locationAddress = competition.facility
    ? [
        competition.facility.street,
        competition.facility.city,
        [competition.facility.stateProvince, competition.facility.postalCode]
          .filter(Boolean)
          .join(" "),
        competition.facility.country,
      ]
        .filter(Boolean)
        .join(", ")
    : [
        competition.streetAddress,
        competition.city,
        [competition.stateProvince, competition.postalCode].filter(Boolean).join(" "),
        competition.country,
      ]
        .filter(Boolean)
        .join(", ");

  const selectedCategory =
    selectedCategoryId === "all"
      ? null
      : competition.categories.find((category) => category.id === selectedCategoryId) || null;

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
  );

  const latestRegistrations = getLatestRegistrations(competition);
  const timelineItems = buildTimelineItems(competition);

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
              getStatusStyle(competition)
            )}
          >
            {getStatusLabel(competition)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCssExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export to CSS
          </Button>
          <Button onClick={() => setIsEditOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
      <CssExportDialog
        competitionId={competitionId}
        open={isCssExportOpen}
        onOpenChange={setIsCssExportOpen}
      />

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
        <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
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
        </ResponsiveTabsList>

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

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {competition.pricingMode === "FREE"
                          ? "Free"
                          : `${formatPrice(competition.entryFee)} (${PRICING_MODE_LABELS[competition.pricingMode] || competition.pricingMode})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {format(new Date(competition.startDate), "MMM d, yyyy")}
                        {competition.endDate && competition.endDate !== competition.startDate && (
                          <> &ndash; {format(new Date(competition.endDate), "MMM d, yyyy")}</>
                        )}
                        {" · "}
                        {formatTime12h(competition.startTime)} &ndash;{" "}
                        {formatTime12h(competition.endTime)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground col-span-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {facilityName || locationAddress ? (
                        <div className="min-w-0">
                          {facilityName && (
                            <span className="font-medium text-foreground">{facilityName}</span>
                          )}
                          {facilityName && locationAddress && <br />}
                          {locationAddress && <span className="text-xs">{locationAddress}</span>}
                        </div>
                      ) : (
                        <span>No location set</span>
                      )}
                    </div>
                    {(() => {
                      const lat = competition.facility?.latitude ?? competition.latitude;
                      const lng = competition.facility?.longitude ?? competition.longitude;
                      if (lat == null || lng == null) return null;
                      return (
                        <div className="col-span-2 mt-2 rounded-md overflow-hidden border border-border">
                          <LocationMap
                            latitude={lat}
                            longitude={lng}
                            label={facilityName ?? "Venue"}
                            sublabel={locationAddress || undefined}
                            className="h-40 min-h-0"
                          />
                        </div>
                      );
                    })()}
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
                            {category._count.entries}{" "}
                            {category._count.entries === 1 ? "entry" : "entries"}
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
              <RegistrationTimeline items={timelineItems} />

              <div className="grid gap-6 lg:grid-cols-2">
                <TransactionHistoryCard
                  lineItems={competition.lineItems ?? []}
                  onViewAll={() => setActiveTab("transactions")}
                />
                <LatestRegistrationsCard
                  registrations={latestRegistrations.map((r) => ({
                    id: r.athleteId,
                    athleteId: r.athleteId,
                    athleteName: r.athleteName,
                    athleteAvatar: r.athleteAvatar,
                    registeredAt: r.registeredAt,
                  }))}
                  drillInHref={(athleteId) =>
                    `/dashboard/competitions/${competition.id}/athletes/${athleteId}`
                  }
                  onViewAll={() => setActiveTab("athletes")}
                />
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
                        ? [result.athlete.firstName, result.athlete.lastName]
                            .filter(Boolean)
                            .join(" ") || "Unknown athlete"
                        : result.team?.name || "Unknown team";

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
                      );
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
              <CardDescription>Competition analytics and reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Competition reports and analytics will be available here, including entry
                  summaries, result breakdowns, and participation trends.
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
  );
}
