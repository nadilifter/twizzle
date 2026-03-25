"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Filter, X } from "lucide-react";

import { ProgramCalendar } from "@/components/program-calendar";
import type { CalendarEvent } from "@/components/program-calendar";
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
import {
  ProgramFiltersContent,
  DEFAULT_FILTERS,
  countActiveFilters,
  type Level,
  type Coach,
  type ProgramFilterState,
} from "@/components/sites/program-filters";

interface SiteCalendarProps {
  slug: string;
  organizationId: string;
  organizationName: string;
  levels: Level[];
  coaches: Coach[];
}

function getAdminProgramUrl(
  programId: string,
  organizationId: string,
  organizationName: string
): string {
  const { protocol, host } = window.location;
  const hostWithoutPort = host.split(":")[0];
  const port = host.includes(":") ? `:${host.split(":")[1]}` : "";

  const parts = hostWithoutPort.split(".");
  const baseDomain = parts.length > 1 ? parts.slice(1).join(".") : hostWithoutPort;

  const adminBase = `${protocol}//admin.${baseDomain}${port}`;
  const redirectPath = `/dashboard/registrations/programs/${programId}`;

  const params = new URLSearchParams({
    orgId: organizationId,
    orgName: organizationName,
    redirect: redirectPath,
  });

  return `${adminBase}/switch-org?${params.toString()}`;
}

export function SiteCalendar({
  slug,
  organizationId,
  organizationName,
  levels,
  coaches,
}: SiteCalendarProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<ProgramFilterState>({ ...DEFAULT_FILTERS });
  const [open, setOpen] = useState(false);

  const activeFilterCount = countActiveFilters(filters, { hideDateRange: true });

  const isAdmin =
    status === "authenticated" &&
    (session?.user?.role === "ADMIN" ||
      session?.user?.permissions?.includes("*"));

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      if (isAdmin) {
        window.location.href = getAdminProgramUrl(
          event.programId,
          organizationId,
          organizationName
        );
      } else {
        router.push(`/programs/${event.programId}?instance=${event.id}`);
      }
    },
    [isAdmin, router, organizationId, organizationName]
  );

  const eventFilter = useCallback(
    (event: CalendarEvent): boolean => {
      const ageActive =
        filters.ageRange[0] !== DEFAULT_FILTERS.ageRange[0] ||
        filters.ageRange[1] !== DEFAULT_FILTERS.ageRange[1];
      if (ageActive && event.hasAgeRestriction) {
        const evMin = event.minAge ?? 0;
        const evMax = event.maxAge ?? 99;
        if (evMin > filters.ageRange[1] || evMax < filters.ageRange[0]) {
          return false;
        }
      }

      const hasTimeFilter = filters.timeRange[0] || filters.timeRange[1];
      if (hasTimeFilter && event.startTime) {
        if (filters.timeRange[0] && event.startTime < filters.timeRange[0]) {
          return false;
        }
        if (filters.timeRange[1] && event.startTime > filters.timeRange[1]) {
          return false;
        }
      }

      if (filters.selectedLevels.length > 0) {
        if (event.hasLevelRestriction && event.levelIds?.length) {
          const hasMatch = event.levelIds.some((id) =>
            filters.selectedLevels.includes(id)
          );
          if (!hasMatch) return false;
        }
      }

      if (filters.selectedCoaches.length > 0) {
        const hasMatch = (event.coachIds ?? []).some((id) =>
          filters.selectedCoaches.includes(id)
        );
        if (!hasMatch) return false;
      }

      return true;
    },
    [filters]
  );

  const hasActiveFilters = activeFilterCount > 0;

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

  const filtersContent = (
    <ProgramFiltersContent
      levels={levels}
      coaches={coaches}
      filters={filters}
      onFiltersChange={setFilters}
      activeFilterCount={activeFilterCount}
      hideDateRange
    />
  );

  const resultLabel = "Apply Filters";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setFilters({ ...DEFAULT_FILTERS })}
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}

        {isMobile ? (
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Filter Calendar</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto">
                {filtersContent}
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button>{resultLabel}</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>{triggerButton}</SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Calendar</SheetTitle>
                <SheetDescription>
                  Narrow down events by age, time, level, or coach
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 overflow-y-auto flex-1">
                {filtersContent}
              </div>
              <SheetFooter className="mt-6">
                <SheetClose asChild>
                  <Button className="w-full">{resultLabel}</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <ProgramCalendar
        slug={slug}
        isPublic={true}
        onEventClick={handleEventClick}
        className="shadow-none"
        eventFilter={hasActiveFilters ? eventFilter : undefined}
      />
    </div>
  );
}
