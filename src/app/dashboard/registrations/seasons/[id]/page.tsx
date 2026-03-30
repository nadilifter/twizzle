"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  Info,
  Layers,
  CreditCard,
  Trophy,
  Repeat,
  Loader2,
  Plus,
  RotateCw,
  X,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorSelector } from "@/components/color-selector";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { useFeatures } from "@/components/feature-context";
import { useSeasons } from "@/hooks/use-seasons";
import type { Season, UpdateSeasonPayload } from "@/hooks/use-seasons";
import { LinkItemDialog } from "./link-item-dialog";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  CLOSED: "outline",
  EXPIRED: "outline",
  CANCELLED: "destructive",
};

interface ProgramItem {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  _count?: { enrollments: number };
}

interface MembershipItem {
  id: string;
  name: string;
  _count?: { instances: number };
}

interface CompetitionItem {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  _count?: { entries: number };
}

export default function SeasonProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const seasonId = params.id as string;
  const { isFeatureEnabled } = useFeatures();
  const showCompetitions = isFeatureEnabled("competitions");

  const { updateSeason } = useSeasons({ autoFetch: false });

  const [season, setSeason] = React.useState<Season | null>(null);
  const [programs, setPrograms] = React.useState<ProgramItem[]>([]);
  const [memberships, setMemberships] = React.useState<MembershipItem[]>([]);
  const [competitions, setCompetitions] = React.useState<CompetitionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);

  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [linkDialogType, setLinkDialogType] = React.useState<
    "program" | "membership" | "competition"
  >("program");

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
    season ? `/dashboard/registrations/seasons/${seasonId}` : undefined,
    season?.name
  );

  const fetchSeason = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}`);
      if (res.ok) {
        const data = await res.json();
        setSeason(data);
        setStartDate(new Date(data.startDate));
        setEndDate(new Date(data.endDate));
      }
    } catch {
      toast.error("Failed to load season");
    }
  }, [seasonId]);

  const fetchLinkedItems = React.useCallback(async () => {
    const [programsRes, membershipsRes, competitionsRes] = await Promise.all([
      fetch(`/api/programs?seasonId=${seasonId}&limit=200`).then((r) =>
        r.ok ? r.json() : { data: [] }
      ),
      fetch(`/api/memberships?seasonId=${seasonId}&limit=200`).then((r) =>
        r.ok ? r.json() : { data: [] }
      ),
      showCompetitions
        ? fetch(`/api/competitions?seasonId=${seasonId}&limit=200`).then((r) =>
            r.ok ? r.json() : { data: [] }
          )
        : Promise.resolve({ data: [] }),
    ]);
    setPrograms(programsRes.data ?? []);
    setMemberships(membershipsRes.data ?? []);
    setCompetitions(competitionsRes.data ?? []);
  }, [seasonId, showCompetitions]);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchSeason(), fetchLinkedItems()]);
      setLoading(false);
    };
    if (seasonId) load();
  }, [seasonId, fetchSeason, fetchLinkedItems]);

  const handleUpdate = async (data: UpdateSeasonPayload) => {
    const result = await updateSeason(seasonId, data);
    if (result) {
      setSeason(result);
      toast.success("Season updated");
    }
  };

  const handleUnlink = async (type: "program" | "membership" | "competition", itemId: string) => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, itemId }),
      });
      if (res.ok) {
        toast.success("Item removed from season");
        await fetchLinkedItems();
        await fetchSeason();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to remove item");
      }
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const openLinkDialog = (type: "program" | "membership" | "competition") => {
    setLinkDialogType(type);
    setLinkDialogOpen(true);
  };

  const handleItemLinked = async () => {
    await fetchLinkedItems();
    await fetchSeason();
  };

  const [rollingOver, setRollingOver] = React.useState(false);

  const handleRollover = async () => {
    setRollingOver(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/rollover`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Season rolled over: ${data.newName}`);
        router.push(`/dashboard/registrations/seasons/${data.newSeasonId}`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Rollover failed");
      }
    } catch {
      toast.error("Rollover failed");
    } finally {
      setRollingOver(false);
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

  if (!season) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">Season not found</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/registrations/seasons">Back to seasons</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/registrations/seasons">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: season.color }}
          />
          <h1 className="text-2xl font-semibold tracking-tight">{season.name}</h1>
          <Badge variant={STATUS_VARIANTS[season.status] || "outline"}>{season.status}</Badge>
          {season.isRecurring && (
            <Badge variant="outline">
              <Repeat className="mr-1 h-3 w-3" />
              Recurring
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {format(new Date(season.startDate), "MMM d, yyyy")} –{" "}
            {format(new Date(season.endDate), "MMM d, yyyy")}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={rollingOver}>
                {rollingOver ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCw className="mr-2 h-4 w-4" />
                )}
                Roll Over Season
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Roll over this season?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a new season with all programs, memberships, and competitions
                  duplicated with dates advanced by one year. The new season will be created as a
                  draft.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRollover} disabled={rollingOver}>
                  {rollingOver ? "Rolling over..." : "Continue"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setActiveTab("programs")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{season._count?.programs ?? programs.length}</p>
                <p className="text-sm text-muted-foreground">Programs</p>
              </div>
              <Layers className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setActiveTab("memberships")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {season._count?.memberships ?? memberships.length}
                </p>
                <p className="text-sm text-muted-foreground">Memberships</p>
              </div>
              <CreditCard className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        {showCompetitions && (
          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setActiveTab("competitions")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {season._count?.competitions ?? competitions.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Competitions</p>
                </div>
                <Trophy className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
          <TabsTrigger value="overview" className="gap-2">
            <Info className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="programs" className="gap-2">
            <Layers className="h-4 w-4" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="memberships" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Memberships
          </TabsTrigger>
          {showCompetitions && (
            <TabsTrigger value="competitions" className="gap-2">
              <Trophy className="h-4 w-4" />
              Competitions
            </TabsTrigger>
          )}
        </ResponsiveTabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    defaultValue={season.name}
                    onBlur={(e) => {
                      if (e.target.value !== season.name) {
                        handleUpdate({ name: e.target.value });
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    defaultValue={season.description || ""}
                    placeholder="Optional description"
                    onBlur={(e) => {
                      const val = e.target.value || null;
                      if (val !== season.description) {
                        handleUpdate({ description: val });
                      }
                    }}
                  />
                </div>

                <ColorSelector
                  value={season.color}
                  onChange={(color) => {
                    setSeason({ ...season, color });
                    handleUpdate({ color });
                  }}
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                          <Calendar
                            mode="single"
                            fixedWeeks
                            captionLayout="dropdown"
                            fromYear={new Date().getFullYear() - 1}
                            toYear={new Date().getFullYear() + 5}
                            selected={startDate}
                            onSelect={(date) => {
                              setStartDate(date);
                              if (date) handleUpdate({ startDate: format(date, "yyyy-MM-dd") });
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                          <Calendar
                            mode="single"
                            fixedWeeks
                            captionLayout="dropdown"
                            fromYear={new Date().getFullYear() - 1}
                            toYear={new Date().getFullYear() + 5}
                            selected={endDate}
                            onSelect={(date) => {
                              setEndDate(date);
                              if (date) handleUpdate({ endDate: format(date, "yyyy-MM-dd") });
                            }}
                            disabled={(date) => (startDate ? date < startDate : false)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={season.status}
                      onValueChange={(val) => handleUpdate({ status: val as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                        <SelectItem value="EXPIRED">Expired</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recurrence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Recurring Season</Label>
                    <Switch
                      checked={season.isRecurring}
                      onCheckedChange={(val) => handleUpdate({ isRecurring: val })}
                    />
                  </div>
                  {season.isRecurring && (
                    <div className="space-y-2">
                      <Label htmlFor="renewalLeadDays">Renewal Lead Days</Label>
                      <Input
                        id="renewalLeadDays"
                        type="number"
                        min={1}
                        value={season.renewalLeadDays}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 30;
                          setSeason({ ...season, renewalLeadDays: val });
                        }}
                        onBlur={() => handleUpdate({ renewalLeadDays: season.renewalLeadDays })}
                        className="max-w-[200px]"
                      />
                      <p className="text-sm text-muted-foreground">
                        Days before this season ends to auto-generate the next season as a draft
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ===== PROGRAMS TAB ===== */}
        <TabsContent value="programs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Programs</CardTitle>
                <CardDescription>
                  {programs.length} program{programs.length !== 1 ? "s" : ""} linked to this season
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => openLinkDialog("program")}>
                <Plus className="mr-2 h-4 w-4" />
                Add Program
              </Button>
            </CardHeader>
            <CardContent>
              {programs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No programs linked to this season yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programs.map((program) => (
                      <TableRow key={program.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/dashboard/registrations/programs/${program.id}`}
                            className="hover:underline"
                          >
                            {program.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {program.startDate
                            ? format(new Date(program.startDate), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {program.endDate ? format(new Date(program.endDate), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{program.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUnlink("program", program.id)}
                            title="Remove from season"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MEMBERSHIPS TAB ===== */}
        <TabsContent value="memberships">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Memberships</CardTitle>
                <CardDescription>
                  {memberships.length} membership{memberships.length !== 1 ? "s" : ""} linked to
                  this season
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => openLinkDialog("membership")}>
                <Plus className="mr-2 h-4 w-4" />
                Add Membership
              </Button>
            </CardHeader>
            <CardContent>
              {memberships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No memberships linked to this season yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Instances</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberships.map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell className="font-medium">{membership.name}</TableCell>
                        <TableCell>{membership._count?.instances ?? "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUnlink("membership", membership.id)}
                            title="Remove from season"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== COMPETITIONS TAB ===== */}
        {showCompetitions && (
          <TabsContent value="competitions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Competitions</CardTitle>
                  <CardDescription>
                    {competitions.length} competition{competitions.length !== 1 ? "s" : ""} linked
                    to this season
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => openLinkDialog("competition")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Competition
                </Button>
              </CardHeader>
              <CardContent>
                {competitions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No competitions linked to this season yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Entries</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitions.map((competition) => (
                        <TableRow key={competition.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/dashboard/competitions/${competition.id}`}
                              className="hover:underline"
                            >
                              {competition.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {format(new Date(competition.startDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {format(new Date(competition.endDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{competition._count?.entries ?? 0}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleUnlink("competition", competition.id)}
                              title="Remove from season"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <LinkItemDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        seasonId={seasonId}
        type={linkDialogType}
        onLinked={handleItemLinked}
      />
    </div>
  );
}
