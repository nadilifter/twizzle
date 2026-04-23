"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  Info,
  Loader2,
  MapPin,
  Receipt,
  Repeat,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { LocationMap } from "@/components/location-map";
import { RegistrationTimeline, type TimelineItem } from "@/components/registration-timeline";
import { TransactionHistoryCard } from "@/components/transaction-history-card";
import { LatestRegistrationsCard } from "@/components/latest-registrations-card";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatPrice } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

import { AthletesTab } from "./athletes-tab";
import { SessionsTab } from "./sessions-tab";
import { TransactionsTab, type ProgramLineItem } from "./transactions-tab";

interface ProgramDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  registrationType: string | null;
  pricingModel: string;
  billingInterval: string;
  basePrice: number | string | null;
  perSessionPrice: number | string | null;
  recurringPrice: number | string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  capacity: number | null;
  createdAt: string;
  registrationStartDate: string | null;
  registrationStartTime: string | null;
  registrationEndDate: string | null;
  registrationEndTime: string | null;
  registrationOpen: boolean;
  waitlistEnabled: boolean;
  waitlistAutoPromote: boolean;
  waitlistCapacity: number | null;
  facility: {
    id: string;
    name: string;
    city?: string | null;
    stateProvince?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  enrollments: {
    id: string;
    status: string;
    createdAt: string;
    athlete: { id: string; name: string; avatar: string | null };
  }[];
  instances: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    capacity: number | null;
    facility: { id: string; name: string; city?: string | null } | null;
    _count: { registrations: number; attendances: number };
  }[];
  lineItems: ProgramLineItem[];
  _count: {
    enrollments: number;
    events: number;
    lessonPlans: number;
    instances: number;
  };
}

interface ProgramAthleteListItem {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  firstRegisteredAt: string;
  sessionCount: number;
}

interface WaitlistEntry {
  id: string;
  position: number;
  athleteId: string;
  athlete: { id: string; name: string; email: string | null; avatar: string | null };
  joinedAt: string;
}

function getDisplayPrice(program: ProgramDetail): string {
  const isRecurring =
    program.billingInterval &&
    program.billingInterval !== "ONE_TIME" &&
    program.billingInterval !== "SESSION" &&
    program.recurringPrice != null;

  const priceSource = isRecurring
    ? program.recurringPrice
    : program.basePrice != null
      ? program.basePrice
      : program.perSessionPrice;

  if (priceSource == null) return "Free";
  const num = typeof priceSource === "string" ? parseFloat(priceSource) : priceSource;
  if (!Number.isFinite(num) || num === 0) return "Free";
  const formatted = formatPrice(num);

  const suffix = isRecurring
    ? program.billingInterval === "MONTHLY"
      ? "/mo"
      : program.billingInterval === "YEARLY"
        ? "/yr"
        : ""
    : program.pricingModel === "PER_SESSION"
      ? "/session"
      : "";
  return formatted + suffix;
}

function buildTimelineItems(program: ProgramDetail): TimelineItem[] {
  const items: TimelineItem[] = [];

  items.push({
    title: "Program Created",
    date: new Date(program.createdAt),
    time: format(new Date(program.createdAt), "h:mm a"),
    hollow: false,
  });

  if (program.registrationStartDate) {
    const d = new Date(program.registrationStartDate);
    items.push({
      title: "Registration Opens",
      date: d,
      time: program.registrationStartTime,
      hollow: !isPast(d),
    });
  }

  if (program.registrationEndDate) {
    const d = new Date(program.registrationEndDate);
    items.push({
      title: "Registration Closes",
      date: d,
      time: program.registrationEndTime,
      hollow: !isPast(d),
    });
  }

  if (program.startDate) {
    const d = new Date(program.startDate);
    items.push({
      title: "Program Begins",
      date: d,
      time: program.startTime,
      hollow: !isPast(d),
    });
  }

  if (program.endDate) {
    const d = new Date(program.endDate);
    items.push({
      title: "Program Ends",
      date: d,
      time: null,
      hollow: !isPast(d),
    });
  }

  return items;
}

function getSessionsPreview(instances: ProgramDetail["instances"]) {
  const now = Date.now();
  const upcoming = instances
    .filter((i) => new Date(i.date).getTime() >= now && i.status !== "CANCELLED")
    .slice(0, 3);
  const recent = [...instances]
    .filter((i) => new Date(i.date).getTime() < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 2);
  return { upcoming, recent };
}

export default function ProgramProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const programId = params.id as string;

  const [program, setProgram] = React.useState<ProgramDetail | null>(null);
  const [athletes, setAthletes] = React.useState<ProgramAthleteListItem[]>([]);
  const [waitlistEntries, setWaitlistEntries] = React.useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [waitlistLoading, setWaitlistLoading] = React.useState(false);
  const [promotingId, setPromotingId] = React.useState<string | null>(null);
  const [orgMismatch, setOrgMismatch] = React.useState<{
    organizationId: string;
    organizationName: string | null;
  } | null>(null);

  const [activeTab, setActiveTabState] = React.useState(searchParams.get("tab") ?? "overview");

  const setActiveTab = React.useCallback(
    (tab: string) => {
      setActiveTabState(tab);
      const qp = new URLSearchParams(searchParams.toString());
      if (tab === "overview") qp.delete("tab");
      else qp.set("tab", tab);
      const qs = qp.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router]
  );

  useBreadcrumbOverride(
    program ? `/dashboard/registrations/programs/${programId}` : undefined,
    program?.name
  );

  React.useEffect(() => {
    const fetchProgram = async () => {
      try {
        const response = await fetch(`/api/programs/${programId}`);
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.code === "ORG_MISMATCH") {
            setOrgMismatch({
              organizationId: data.organizationId,
              organizationName: data.organizationName,
            });
            return;
          }
          throw new Error("Failed to fetch program");
        }
        const data = await response.json();
        setProgram(data);
      } catch {
        toast.error("Failed to load program");
      } finally {
        setLoading(false);
      }
    };

    const fetchAthletes = async () => {
      try {
        const response = await fetch(`/api/programs/${programId}/athletes`);
        if (!response.ok) return;
        const data = await response.json();
        setAthletes(data.athletes ?? []);
      } catch {
        // Non-critical for overview; athletes tab has its own fetch
      }
    };

    const fetchWaitlist = async () => {
      setWaitlistLoading(true);
      try {
        const response = await fetch(`/api/programs/${programId}/waitlist`);
        if (response.ok) {
          const data = await response.json();
          setWaitlistEntries(data.waitlisted || []);
        }
      } catch {
        // Non-critical
      } finally {
        setWaitlistLoading(false);
      }
    };

    if (programId) {
      fetchProgram();
      fetchAthletes();
      fetchWaitlist();
    }
  }, [programId]);

  const promoteFromWaitlist = async (enrollmentId: string) => {
    setPromotingId(enrollmentId);
    try {
      const response = await fetch(`/api/programs/${programId}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      if (!response.ok) throw new Error("Failed to promote");
      toast.success("Athlete promoted from waitlist");
      // Refresh waitlist
      const ws = await fetch(`/api/programs/${programId}/waitlist`);
      if (ws.ok) {
        const data = await ws.json();
        setWaitlistEntries(data.waitlisted || []);
      }
    } catch {
      toast.error("Failed to promote from waitlist");
    } finally {
      setPromotingId(null);
    }
  };

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

  if (orgMismatch) {
    const switchUrl = `/dashboard/switch-org?orgId=${encodeURIComponent(orgMismatch.organizationId)}&orgName=${encodeURIComponent(orgMismatch.organizationName || "")}&redirect=${encodeURIComponent(`/dashboard/registrations/programs/${programId}`)}`;
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Wrong organization</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            This program belongs to{" "}
            <span className="font-medium text-foreground">
              {orgMismatch.organizationName || "another organization"}
            </span>
            . Switch organizations to view it.
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" asChild>
              <Link href="/dashboard/registrations/programs">Back to Programs</Link>
            </Button>
            <Button asChild>
              <Link href={switchUrl}>
                Switch to {orgMismatch.organizationName || "Organization"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">Program not found</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/registrations/programs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Programs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPerInstance = program.registrationType === "PER_INSTANCE";
  const recurringBadge = isPerInstance ? "Drop-in" : "Recurring";
  const recurringStyle = isPerInstance
    ? "bg-purple-50 text-purple-700 border-purple-200"
    : "bg-blue-50 text-blue-700 border-blue-200";
  const statusStyle =
    program.status === "ACTIVE"
      ? "bg-green-50 text-green-700 border-green-200"
      : program.status === "ARCHIVED"
        ? "bg-muted text-muted-foreground"
        : "bg-yellow-50 text-yellow-700 border-yellow-200";

  const timelineItems = buildTimelineItems(program);
  const { upcoming, recent } = getSessionsPreview(program.instances);

  const latestAthletes = [...athletes]
    .sort(
      (a, b) => new Date(b.firstRegisteredAt).getTime() - new Date(a.firstRegisteredAt).getTime()
    )
    .map((a) => ({
      id: a.id,
      athleteId: a.id,
      athleteName:
        [a.firstName, a.lastName].filter(Boolean).join(" ") || a.name || "Unknown athlete",
      athleteAvatar: a.avatar,
      registeredAt: a.firstRegisteredAt,
      subtitle:
        isPerInstance && a.sessionCount > 0
          ? `${a.sessionCount} session${a.sessionCount === 1 ? "" : "s"}`
          : undefined,
    }));

  const facilityAddress = program.facility
    ? [program.facility.city, program.facility.stateProvince].filter(Boolean).join(", ")
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0",
              statusStyle
            )}
          >
            {program.status}
          </Badge>
          <Badge variant="outline" className={cn("h-5 px-1.5 gap-1 shrink-0", recurringStyle)}>
            <Repeat className="h-3 w-3" />
            {recurringBadge}
          </Badge>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/registrations/programs/${programId}/edit`}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      {program.description && (
        <div
          className="text-muted-foreground text-sm -mt-2 [&>p]:m-0"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) }}
        />
      )}

      {/* Metric row */}
      <div className={cn("grid gap-4", isPerInstance ? "md:grid-cols-5" : "md:grid-cols-4")}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{program._count.instances}</div>
          </CardContent>
        </Card>
        {isPerInstance ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Athletes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{athletes.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Registrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {athletes.reduce((sum, a) => sum + a.sessionCount, 0)}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Enrollments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{program._count.enrollments}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{program.capacity ?? "Unlimited"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getDisplayPrice(program)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
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
          <TabsTrigger value="sessions" className="gap-2">
            <Calendar className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <Receipt className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-2">
            <Clock className="h-4 w-4" />
            Waitlist
          </TabsTrigger>
        </ResponsiveTabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left column */}
            <div className="space-y-6">
              {/* Program Info */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5 shrink-0" />
                      <span>{getDisplayPrice(program)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span>{isPerInstance ? "Drop-in / Per Session" : "Full Program"}</span>
                    </div>
                    {program.startDate && (
                      <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {format(new Date(program.startDate), "MMM d, yyyy")}
                          {program.endDate && program.endDate !== program.startDate && (
                            <> &ndash; {format(new Date(program.endDate), "MMM d, yyyy")}</>
                          )}
                          {program.startTime && <> · {program.startTime}</>}
                          {program.duration && <> ({program.duration} min)</>}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 text-muted-foreground col-span-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {program.facility ? (
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">
                            {program.facility.name}
                          </span>
                          {facilityAddress && (
                            <>
                              <br />
                              <span className="text-xs">{facilityAddress}</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span>No facility set</span>
                      )}
                    </div>
                    {program.facility?.latitude != null && program.facility?.longitude != null && (
                      <div className="col-span-2 mt-2 rounded-md overflow-hidden border border-border">
                        <LocationMap
                          latitude={program.facility.latitude}
                          longitude={program.facility.longitude}
                          label={program.facility.name}
                          sublabel={facilityAddress || undefined}
                          className="h-40 min-h-0"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sessions preview: 3 upcoming + 2 recent */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Sessions</CardTitle>
                  {program._count.instances > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setActiveTab("sessions")}
                    >
                      View All
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {upcoming.length === 0 && recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sessions yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {upcoming.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Upcoming
                          </p>
                          {upcoming.map((s) => (
                            <Link
                              key={s.id}
                              href={`/dashboard/registrations/programs/${programId}/sessions/${s.id}`}
                              className="block rounded-md border border-border p-2 hover:bg-muted/50"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <div>
                                  <p className="font-medium">
                                    {format(new Date(s.date), "EEE, MMM d")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {s.startTime} &ndash; {s.endTime}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {s._count.registrations}
                                  {s.capacity ? `/${s.capacity}` : ""}
                                </Badge>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {recent.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Recent
                          </p>
                          {recent.map((s) => (
                            <Link
                              key={s.id}
                              href={`/dashboard/registrations/programs/${programId}/sessions/${s.id}`}
                              className="block rounded-md border border-border p-2 hover:bg-muted/50"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <div>
                                  <p className="font-medium">
                                    {format(new Date(s.date), "EEE, MMM d")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {s.startTime} &ndash; {s.endTime}
                                  </p>
                                </div>
                                <Badge variant="outline" className="shrink-0">
                                  {s.status}
                                </Badge>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="md:col-span-2 space-y-6">
              <RegistrationTimeline items={timelineItems} />

              <div className="grid gap-6 lg:grid-cols-2">
                <TransactionHistoryCard
                  lineItems={program.lineItems ?? []}
                  onViewAll={() => setActiveTab("transactions")}
                />
                <LatestRegistrationsCard
                  registrations={latestAthletes}
                  drillInHref={(athleteId) =>
                    `/dashboard/registrations/programs/${programId}/athletes/${athleteId}`
                  }
                  onViewAll={() => setActiveTab("athletes")}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="athletes">
          <AthletesTab programId={programId} />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsTab programId={programId} />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab
            lineItems={program.lineItems ?? []}
            athleteHrefPrefix={`/dashboard/registrations/programs/${programId}/athletes`}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Attendance dashboard ships in the next PR.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations">
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Evaluations dashboard ships in the next PR.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist">
          {!program.waitlistEnabled ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Waitlist is disabled for this program. Enable it in Settings to start accepting
                  waitlisted athletes.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Waitlist
                </CardTitle>
                <CardDescription>
                  {waitlistEntries.length} athlete
                  {waitlistEntries.length === 1 ? "" : "s"} on the waitlist
                  {program.waitlistCapacity != null && ` (max ${program.waitlistCapacity})`}
                  {program.waitlistAutoPromote && " · Auto-promote enabled"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {waitlistLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                ) : waitlistEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No one is currently on the waitlist.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Athlete</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waitlistEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.position}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={entry.athlete.avatar || undefined} />
                                <AvatarFallback className="text-xs">
                                  {entry.athlete.name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <Link
                                  href={`/dashboard/registrations/programs/${programId}/athletes/${entry.athlete.id}`}
                                  className="font-medium text-sm text-primary hover:underline"
                                >
                                  {entry.athlete.name}
                                </Link>
                                {entry.athlete.email && (
                                  <div className="text-xs text-muted-foreground">
                                    {entry.athlete.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(entry.joinedAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => promoteFromWaitlist(entry.id)}
                              disabled={promotingId !== null}
                            >
                              {promotingId === entry.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              Promote
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
