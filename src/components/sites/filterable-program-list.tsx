"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { Filter, SearchX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { ProgramCard } from "./program-card";
import {
  ProgramFiltersContent,
  DEFAULT_FILTERS,
  countActiveFilters,
  type Level,
  type Coach,
  type SeasonFilter,
  type CategoryFilter,
  type FacilityFilter,
  type ProgramFilterState,
} from "./program-filters";

// Re-use the same Program shape that ProgramCard and ProgramList expect
interface Program {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  staffAssignments?: {
    id: string;
    role: string;
    isPrimary: boolean;
    member: {
      id: string;
      title: string | null;
      user: { id: string; name: string; avatar: string | null };
    };
  }[];
  requiredMemberships?: {
    id: string;
    name: string;
    price: number;
    billingInterval: string;
    group: { id: string; name: string };
  }[];
  levelRequirements?: {
    id: string;
    levelId: string;
    level: { id: string; name: string; color: string | null };
  }[];
  showCoachOnSite?: boolean;
  bulkDiscounts?: {
    id: string;
    type: "FAMILY_SIBLING" | "MULTI_SESSION";
    minQuantity: number;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number | string;
    description: string | null;
  }[];
  pricingModel?: string;
  basePrice?: number | string | null;
  perSessionPrice?: number | string | null;
  billingInterval?: string;
  recurringPrice?: number | string | null;
  registrationType?: "ALL_INSTANCES" | "PER_INSTANCE" | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  startTime?: string | null;
  duration?: number | null;
  rrule?: string | null;
  facility?: {
    id: string;
    name: string;
    city?: string | null;
    stateProvince?: string | null;
  } | null;
  instances?: {
    id: string;
    date: string | Date;
    startTime: string;
    endTime: string;
    status: string;
  }[];
  capacity?: number | null;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  hasGenderRestriction?: boolean;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  waitlistEnabled?: boolean;
  waitlistCapacity?: number | null;
  allowedGenders?: ("MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY")[];
  seasonId?: string | null;
  categoryId?: string | null;
  _count?: { instances?: number; enrollments?: number; waitlistedEnrollments?: number };
}

interface CategoryInfo {
  id: string;
  name: string;
  description?: string | null;
}

interface FilterableProgramListProps {
  programs: Program[];
  levels: Level[];
  seasons?: SeasonFilter[];
  slug: string;
  primaryColor?: string;
  initialCoachId?: string;
  categories?: CategoryInfo[];
  initialCategoryId?: string;
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

export function FilterableProgramList({
  programs,
  levels,
  seasons = [],
  slug,
  primaryColor,
  initialCoachId,
  categories = [],
  initialCategoryId,
}: FilterableProgramListProps) {
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<ProgramFilterState>(() => ({
    ...DEFAULT_FILTERS,
    selectedCoaches: initialCoachId ? [initialCoachId] : [],
    selectedCategory: initialCategoryId || "",
  }));
  const [open, setOpen] = useState(false);

  const activeFilterCount = countActiveFilters(filters);

  // Derive unique coaches from all programs' staffAssignments
  const coaches = useMemo<Coach[]>(() => {
    const map = new Map<string, Coach>();
    for (const program of programs) {
      for (const sa of program.staffAssignments ?? []) {
        const user = sa.member.user;
        if (!map.has(user.id)) {
          map.set(user.id, { id: user.id, name: user.name, avatar: user.avatar });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [programs]);

  // Derive unique facilities from programs
  const facilities = useMemo<FacilityFilter[]>(() => {
    const map = new Map<string, FacilityFilter>();
    for (const program of programs) {
      if (program.facility && !map.has(program.facility.id)) {
        map.set(program.facility.id, { id: program.facility.id, name: program.facility.name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    return programs.filter((program) => {
      // Age filter: show programs whose age range overlaps the filter range
      // Programs without age restriction always match
      const ageActive =
        filters.ageRange[0] !== DEFAULT_FILTERS.ageRange[0] ||
        filters.ageRange[1] !== DEFAULT_FILTERS.ageRange[1];
      if (ageActive) {
        if (program.hasAgeRestriction) {
          const progMin = program.minAge ?? 0;
          const progMax = program.maxAge ?? 99;
          // Ranges overlap when: progMin <= filterMax AND progMax >= filterMin
          if (progMin > filters.ageRange[1] || progMax < filters.ageRange[0]) {
            return false;
          }
        }
        // No age restriction => always passes
      }

      // Date range filter: show programs whose [startDate, endDate] overlaps the filter date range
      if (filters.dateRange?.from) {
        const filterFrom = startOfDay(filters.dateRange.from);
        const filterTo = filters.dateRange.to ? startOfDay(filters.dateRange.to) : filterFrom;

        const progStart = toDate(program.startDate);
        const progEnd = toDate(program.endDate);

        if (progStart || progEnd) {
          // Program has at least one date set
          const effectiveStart = progStart || progEnd!;
          const effectiveEnd = progEnd || progStart!;

          // Check overlap: programStart <= filterEnd AND programEnd >= filterStart
          if (
            isAfter(startOfDay(effectiveStart), filterTo) ||
            isBefore(startOfDay(effectiveEnd), filterFrom)
          ) {
            return false;
          }
        }
        // Programs with no dates at all: show them (they might be open-ended)
      }

      // Time range filter: program's startTime falls within the filter range
      const hasTimeFilter = filters.timeRange[0] || filters.timeRange[1];
      if (hasTimeFilter && program.startTime) {
        const progTime = program.startTime; // "HH:mm" format
        if (filters.timeRange[0] && progTime < filters.timeRange[0]) {
          return false;
        }
        if (filters.timeRange[1] && progTime > filters.timeRange[1]) {
          return false;
        }
      }

      // Level filter: show programs that require ANY of the selected levels
      if (filters.selectedLevels.length > 0) {
        if (program.hasLevelRestriction && program.levelRequirements?.length) {
          const hasMatchingLevel = program.levelRequirements.some((lr) =>
            filters.selectedLevels.includes(lr.level.id)
          );
          if (!hasMatchingLevel) {
            return false;
          }
        }
        // Programs without level restriction: always show
      }

      // Coach filter: show programs that have ANY of the selected coaches assigned
      if (filters.selectedCoaches.length > 0) {
        const hasMatchingCoach = (program.staffAssignments ?? []).some((sa) =>
          filters.selectedCoaches.includes(sa.member.user.id)
        );
        if (!hasMatchingCoach) {
          return false;
        }
      }

      // Season filter
      if (filters.selectedSeason) {
        if (program.seasonId !== filters.selectedSeason) {
          return false;
        }
      }

      // Category filter
      if (filters.selectedCategory) {
        if (program.categoryId !== filters.selectedCategory) {
          return false;
        }
      }

      // Facility filter
      if (filters.selectedFacility) {
        if (program.facility?.id !== filters.selectedFacility) {
          return false;
        }
      }

      // Gender filter
      if (filters.selectedGenders.length > 0) {
        if (program.hasGenderRestriction && program.allowedGenders?.length) {
          const hasOverlap = program.allowedGenders.some((g) =>
            filters.selectedGenders.includes(g)
          );
          if (!hasOverlap) return false;
        }
      }

      return true;
    });
  }, [programs, filters]);

  const hasCategories = categories.length > 0;

  // Group filtered programs by category
  const groupedPrograms = useMemo(() => {
    if (!hasCategories) return null;

    const groups: { category: CategoryInfo | null; programs: Program[] }[] = [];
    const categoryMap = new Map<string, Program[]>();
    const uncategorized: Program[] = [];

    for (const program of filteredPrograms) {
      if (program.categoryId) {
        const existing = categoryMap.get(program.categoryId) || [];
        existing.push(program);
        categoryMap.set(program.categoryId, existing);
      } else {
        uncategorized.push(program);
      }
    }

    for (const cat of categories) {
      const progs = categoryMap.get(cat.id);
      if (progs && progs.length > 0) {
        groups.push({ category: cat, programs: progs });
      }
    }

    if (uncategorized.length > 0) {
      groups.push({ category: null, programs: uncategorized });
    }

    return groups;
  }, [filteredPrograms, categories, hasCategories]);

  // Scroll to category section if initialCategoryId is provided
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (initialCategoryId && !scrolledRef.current) {
      scrolledRef.current = true;
      const sectionId =
        initialCategoryId === "other" ? "category-other" : `category-${initialCategoryId}`;
      const el = document.getElementById(sectionId);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    }
  }, [initialCategoryId]);

  // Shared trigger button
  const triggerButton = (
    <Button variant="outline" size="sm" className="gap-2">
      <Filter className="h-4 w-4" />
      Filters
      {activeFilterCount > 0 && (
        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  );

  // Shared filter content
  const filtersContent = (
    <ProgramFiltersContent
      levels={levels}
      coaches={coaches}
      seasons={seasons}
      categories={categories}
      facilities={facilities}
      showGenderFilter
      filters={filters}
      onFiltersChange={setFilters}
    />
  );

  const resultLabel = `Show ${filteredPrograms.length} program${filteredPrograms.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-6">
      {/* Filter bar: tray trigger + result count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredPrograms.length} of {programs.length} program{programs.length !== 1 ? "s" : ""}
        </p>

        {isMobile ? (
          /* Mobile: bottom Drawer */
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Filter Programs</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto">{filtersContent}</div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button>{resultLabel}</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          /* Desktop: right-side Sheet */
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>{triggerButton}</SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Filter Programs</SheetTitle>
                <SheetDescription>
                  Narrow down programs by age, schedule, time, or level
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex-1 overflow-y-auto min-h-0 pr-1">{filtersContent}</div>
              <div className="border-t pt-4 mt-4 flex flex-col gap-2 shrink-0">
                <SheetClose asChild>
                  <Button className="w-full">{resultLabel}</Button>
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
        )}
      </div>

      {/* Program Grid */}
      {filteredPrograms.length > 0 ? (
        hasCategories && groupedPrograms ? (
          <div className="space-y-12">
            {groupedPrograms.map((group) => (
              <section
                key={group.category?.id || "other"}
                id={group.category ? `category-${group.category.id}` : "category-other"}
              >
                <div className="mb-4">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {group.category?.name || "Other Programs"}
                  </h2>
                  {group.category?.description && (
                    <p className="mt-1 text-muted-foreground">{group.category.description}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.programs.map((program) => (
                    <ProgramCard key={program.id} program={program} primaryColor={primaryColor} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} primaryColor={primaryColor} />
            ))}
          </div>
        )
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
        /* No programs at all */
        <div className="text-center py-16 rounded-xl border bg-muted/30">
          <p className="text-muted-foreground text-lg">
            No programs are currently available for registration.
          </p>
        </div>
      )}
    </div>
  );
}
