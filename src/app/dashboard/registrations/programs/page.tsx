"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { sanitizeHtml } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Settings,
  Loader2,
  AlertCircle,
  CalendarDays,
  CalendarClock,
  Clock,
  MapPin,
  Users,
  UserCheck,
  Shield,
  Repeat,
  Star,
  User,
  Filter,
  SearchX,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePrograms } from "@/hooks/use-programs";
import { useSeasons } from "@/hooks/use-seasons";
import { useFacilities } from "@/hooks/use-facilities";
import { useLevels } from "@/hooks/use-levels";
import { useCategories } from "@/hooks/use-categories";
import { useStaff } from "@/hooks/use-staff";
import { useFeatures } from "@/components/feature-context";
import { formatRRuleDays } from "@/lib/rrule-utils";
import { formatTime12h } from "@/lib/date-utils";
import { ProgramConfiguration } from "./program-configuration";
import {
  PROGRAM_STATUS_CONFIG,
  REGISTRATION_STATUS_CONFIG,
  type ProgramStatus,
  type RegistrationWindowStatus,
} from "@/types/programs";
import {
  ProgramFiltersContent,
  DEFAULT_FILTERS,
  countActiveFilters,
  type ProgramFilterState,
} from "@/components/sites/program-filters";

const PROGRAM_SORT_ORDER: Record<string, number> = {
  OPEN: 0,
  SCHEDULED: 1,
  DRAFT: 2,
  COMPLETE: 3,
};

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "Free";
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (numPrice === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numPrice);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  try {
    return parseISO(value);
  } catch {
    return null;
  }
}

export default function ProgramsPage() {
  const router = useRouter();
  const { programs, isLoading, error, fetchPrograms } = usePrograms({ autoFetch: false });
  const { isFeatureEnabled } = useFeatures();
  const seasonsEnabled = isFeatureEnabled("seasons");
  const trainingEnabled = isFeatureEnabled("training");
  const { seasons } = useSeasons({ autoFetch: seasonsEnabled });
  const { facilities } = useFacilities();
  const { levels } = useLevels();
  const { categories } = useCategories();
  const { staff } = useStaff();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [filters, setFilters] = React.useState<ProgramFilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [selectedProgram, setSelectedProgram] = React.useState<any>(null);

  const activeFilterCount = countActiveFilters(filters);

  // Derive coaches from staff
  const coaches = React.useMemo(() => {
    return staff
      .map((s) => ({
        id: s.user.id,
        name: s.user.name || "",
        avatar: s.user.avatar || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff]);

  // Fetch programs with search only (all other filtering is client-side)
  const hasFetched = React.useRef(false);
  React.useEffect(() => {
    const params = { search: searchTerm };
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchPrograms(params);
      return;
    }
    const timer = setTimeout(() => fetchPrograms(params), 500);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchPrograms]);

  // Client-side filtering
  const filteredPrograms = React.useMemo(() => {
    return programs
      .filter((program) => {
        const p = program as any;

        // Status filter — multi-select; default is ["DRAFT", "ACTIVE"]
        if (filters.selectedStatus.length > 0) {
          if (!filters.selectedStatus.includes(p.status)) return false;
        }

        // Season filter
        if (filters.selectedSeason && p.seasonId !== filters.selectedSeason) return false;

        // Category filter
        if (filters.selectedCategory && p.categoryId !== filters.selectedCategory) return false;

        // Facility filter
        if (filters.selectedFacility && p.facilityId !== filters.selectedFacility) return false;

        // Age filter: show programs whose age range overlaps the filter range
        const ageActive =
          filters.ageRange[0] !== DEFAULT_FILTERS.ageRange[0] ||
          filters.ageRange[1] !== DEFAULT_FILTERS.ageRange[1];
        if (ageActive) {
          if (p.hasAgeRestriction) {
            const progMin = p.minAge ?? 0;
            const progMax = p.maxAge ?? 99;
            if (progMin > filters.ageRange[1] || progMax < filters.ageRange[0]) {
              return false;
            }
          }
        }

        // Date range filter
        if (filters.dateRange?.from) {
          const filterFrom = startOfDay(filters.dateRange.from);
          const filterTo = filters.dateRange.to ? startOfDay(filters.dateRange.to) : filterFrom;
          const progStart = toDate(p.startDate);
          const progEnd = toDate(p.endDate);
          if (progStart || progEnd) {
            const effectiveStart = progStart || progEnd!;
            const effectiveEnd = progEnd || progStart!;
            if (
              isAfter(startOfDay(effectiveStart), filterTo) ||
              isBefore(startOfDay(effectiveEnd), filterFrom)
            ) {
              return false;
            }
          }
        }

        // Time range filter
        const hasTimeFilter = filters.timeRange[0] || filters.timeRange[1];
        if (hasTimeFilter && p.startTime) {
          if (filters.timeRange[0] && p.startTime < filters.timeRange[0]) return false;
          if (filters.timeRange[1] && p.startTime > filters.timeRange[1]) return false;
        }

        // Level filter
        if (filters.selectedLevels.length > 0) {
          if (p.hasLevelRestriction && p.levelRequirements?.length) {
            const hasMatchingLevel = p.levelRequirements.some((lr: any) =>
              filters.selectedLevels.includes(lr.level.id)
            );
            if (!hasMatchingLevel) return false;
          }
        }

        // Coach filter
        if (filters.selectedCoaches.length > 0) {
          const hasMatchingCoach = (p.staffAssignments ?? []).some((sa: any) =>
            filters.selectedCoaches.includes(sa.member?.user?.id)
          );
          if (!hasMatchingCoach) return false;
        }

        // Gender filter
        if (filters.selectedGenders.length > 0) {
          if (p.hasGenderRestriction && p.allowedGenders?.length > 0) {
            const hasOverlap = p.allowedGenders.some((g: string) =>
              filters.selectedGenders.includes(g)
            );
            if (!hasOverlap) return false;
          }
        }

        // Recurring / Drop-in filter
        if (filters.recurringFilter !== "all") {
          const instanceCount = p._count?.instances ?? 0;
          const isDropIn = !p.rrule || instanceCount <= 1;
          if (filters.recurringFilter === "recurring" && isDropIn) return false;
          if (filters.recurringFilter === "drop-in" && !isDropIn) return false;
        }

        return true;
      })
      .sort((a: any, b: any) => {
        const aOrder =
          PROGRAM_SORT_ORDER[a.registrationStatus ?? a.status] ?? PROGRAM_SORT_ORDER[a.status] ?? 5;
        const bOrder =
          PROGRAM_SORT_ORDER[b.registrationStatus ?? b.status] ?? PROGRAM_SORT_ORDER[b.status] ?? 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
  }, [programs, filters]);

  const handleQuickConfigure = (program: any) => {
    if (program.status === "DRAFT") {
      router.push(`/dashboard/registrations/programs/${program.id}/edit`);
      return;
    }
    setSelectedProgram(program);
    setIsConfigOpen(true);
  };

  const resultLabel = `${filteredPrograms.length} of ${programs.length} program${programs.length !== 1 ? "s" : ""}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Programs"
        description="Manage your registration programs and enrollment options."
        actions={
          <Button asChild>
            <Link href="/dashboard/registrations/programs/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Program
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search programs..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex-1 gap-2 sm:flex-none">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Filter Programs</SheetTitle>
                <SheetDescription>
                  Narrow down programs by status, facility, level, and more
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex-1 overflow-y-auto min-h-0 pr-1">
                <ProgramFiltersContent
                  levels={
                    trainingEnabled
                      ? levels.map((l) => ({ id: l.id, name: l.name, color: l.color }))
                      : []
                  }
                  coaches={coaches}
                  seasons={
                    seasonsEnabled
                      ? seasons.map((s) => ({ id: s.id, name: s.name, color: s.color }))
                      : undefined
                  }
                  categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                  facilities={facilities.map((f) => ({ id: f.id, name: f.name }))}
                  showGenderFilter
                  showStatusFilter
                  showSeasonFilter={seasonsEnabled}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
              <div className="border-t pt-4 mt-4 flex flex-col gap-2 shrink-0">
                <SheetClose asChild>
                  <Button className="w-full">
                    Show {filteredPrograms.length} program{filteredPrograms.length !== 1 ? "s" : ""}
                  </Button>
                </SheetClose>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                    className="w-full gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && !error && programs.length > 0 && (
        <p className="text-sm text-muted-foreground">{resultLabel}</p>
      )}

      {isLoading && programs.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="mt-auto flex items-center justify-between border-t pt-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      {/* Quick Configuration Sheet */}
      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
          {selectedProgram ? (
            <ProgramConfiguration
              key={selectedProgram.id}
              program={selectedProgram}
              onClose={() => setIsConfigOpen(false)}
              onUpdated={() => fetchPrograms()}
            />
          ) : (
            <div className="p-6">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {!isLoading && !error && (
        <>
          {filteredPrograms.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPrograms.map((program) => {
                const p = program as any;
                const isRecurring =
                  p.billingInterval &&
                  p.billingInterval !== "ONE_TIME" &&
                  p.billingInterval !== "SESSION" &&
                  p.recurringPrice &&
                  (p._count?.instances ?? 0) > 1;
                const price = isRecurring ? p.recurringPrice : p.basePrice || p.perSessionPrice;
                const levelReqs = p.levelRequirements || [];
                const staffAssignments = p.staffAssignments || [];
                const requiredMemberships = p.requiredMemberships || [];
                const capacity = p.capacity || 0;
                const enrolled = program._count?.enrollments || 0;
                const hasCapacity = p.hasCapacityRestriction && capacity > 0;
                const spotsLeft = hasCapacity ? Math.max(0, capacity - enrolled) : null;
                const regStatus = p.status;

                const daysLabel = p.rrule ? formatRRuleDays(p.rrule) : null;

                // Age restriction label
                const hasAge = p.hasAgeRestriction && (p.minAge !== null || p.maxAge !== null);
                const ageLabel = hasAge
                  ? p.minAge && p.maxAge
                    ? `Ages ${p.minAge}–${p.maxAge}`
                    : p.minAge
                      ? `Ages ${p.minAge}+`
                      : `Up to age ${p.maxAge}`
                  : null;

                return (
                  <Card key={program.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 min-w-0">
                          <CardTitle className="leading-tight flex items-center gap-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: program.color || "#3b82f6" }}
                            />
                            <Link
                              href={
                                program.status === "DRAFT"
                                  ? `/dashboard/registrations/programs/${program.id}/edit`
                                  : `/dashboard/registrations/programs/${program.id}`
                              }
                              className="hover:underline"
                            >
                              {program.name}
                            </Link>
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-1">
                            {levelReqs.map((lr: any) => (
                              <Badge
                                key={lr.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                                style={
                                  lr.level?.color
                                    ? {
                                        backgroundColor: `${lr.level.color}15`,
                                        color: lr.level.color,
                                        borderColor: `${lr.level.color}40`,
                                      }
                                    : undefined
                                }
                              >
                                {lr.level?.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {/* Single badge: registration status when active, program status otherwise */}
                          {regStatus === "ACTIVE" && p.registrationStatus ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${REGISTRATION_STATUS_CONFIG[p.registrationStatus as RegistrationWindowStatus]?.badgeClassName}`}
                            >
                              {
                                REGISTRATION_STATUS_CONFIG[
                                  p.registrationStatus as RegistrationWindowStatus
                                ]?.label
                              }
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${PROGRAM_STATUS_CONFIG[regStatus as ProgramStatus]?.badgeClassName ?? PROGRAM_STATUS_CONFIG.DRAFT.badgeClassName}`}
                            >
                              {PROGRAM_STATUS_CONFIG[regStatus as ProgramStatus]?.label ?? "Draft"}
                            </Badge>
                          )}
                          {program.season && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                              style={{
                                borderColor: program.season.color,
                                color: program.season.color,
                              }}
                            >
                              {program.season.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 pb-3">
                      {program.description && (
                        <div
                          className="text-sm text-muted-foreground line-clamp-2 mb-3 [&>p]:m-0"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) }}
                        />
                      )}

                      {/* Info grid */}
                      <div className="space-y-1.5">
                        {/* Schedule type + price */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Repeat className="h-3.5 w-3.5" />
                            <span>Recurring</span>
                            {p.registrationType === "PER_INSTANCE" && (
                              <span className="text-primary">(Drop-in)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <span>{formatPrice(price)}</span>
                            {price && isRecurring && p.billingInterval === "MONTHLY" && (
                              <span className="text-muted-foreground">/month</span>
                            )}
                            {price && isRecurring && p.billingInterval === "YEARLY" && (
                              <span className="text-muted-foreground">/year</span>
                            )}
                            {price && !isRecurring && p.pricingModel === "PER_SESSION" && (
                              <span className="text-muted-foreground">/session</span>
                            )}
                          </div>
                        </div>

                        {daysLabel && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span>{daysLabel}</span>
                          </div>
                        )}

                        {/* Location */}
                        {p.facility && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>
                              {p.facility.name}
                              {p.facility.city && `, ${p.facility.city}`}
                            </span>
                          </div>
                        )}

                        {/* Time */}
                        {p.startTime && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {formatTime12h(p.startTime)}
                              {p.duration ? ` (${p.duration} min)` : ""}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tags row: capacity, age, membership */}
                      {(hasCapacity || ageLabel || requiredMemberships.length > 0) && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {hasCapacity && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-full">
                              <Users className="h-3 w-3" />
                              {spotsLeft !== null ? `${enrolled}/${capacity}` : `${capacity} cap`}
                            </div>
                          )}
                          {ageLabel && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                              <UserCheck className="h-3 w-3" />
                              {ageLabel}
                            </div>
                          )}
                          {requiredMemberships.length > 0 && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                              <Shield className="h-3 w-3" />
                              Membership Req.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Coaches */}
                      {staffAssignments.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                            {staffAssignments.slice(0, 3).map((sa: any) => (
                              <Avatar key={sa.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={sa.member?.user?.avatar || ""} />
                                <AvatarFallback className="text-[10px]">
                                  <User className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {staffAssignments.slice(0, 2).map((sa: any, i: number) => (
                              <span key={sa.id}>
                                {i > 0 && ", "}
                                {sa.member?.user?.name}
                                {sa.isPrimary && (
                                  <Star className="h-3 w-3 inline ml-0.5 text-amber-500" />
                                )}
                              </span>
                            ))}
                            {staffAssignments.length > 2 && (
                              <span> +{staffAssignments.length - 2}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="border-t pt-3 gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/dashboard/registrations/programs/${program.id}/sessions`}>
                          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                          Sessions
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuickConfigure(program)}
                        title="Configure"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : programs.length > 0 ? (
            /* No results from filtering */
            <div className="text-center py-16 rounded-xl border bg-muted/30">
              <SearchX className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground text-lg mb-1">No matching programs</p>
              <p className="text-muted-foreground text-sm mb-4">
                Try adjusting your filters to see more results.
              </p>
              <Button
                variant="outline"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No programs found. Create one to get started.
            </div>
          )}
        </>
      )}
    </div>
  );
}
