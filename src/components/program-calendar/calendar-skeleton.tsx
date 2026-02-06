"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface CalendarSkeletonProps {
  viewMode: "month" | "week" | "day";
}

export function CalendarSkeleton({ viewMode }: CalendarSkeletonProps) {
  if (viewMode === "month") {
    return <MonthViewSkeleton />;
  }
  if (viewMode === "week") {
    return <WeekViewSkeleton />;
  }
  return <DayViewSkeleton />;
}

// Deterministic pattern for skeleton event counts per day (avoids hydration mismatch)
const MONTH_EVENT_PATTERN = [
  2, 0, 1, 0, 2, 1, 0,
  1, 2, 0, 1, 0, 2, 1,
  0, 1, 2, 0, 1, 0, 2,
  2, 0, 1, 2, 0, 1, 0,
  1, 0, 2, 1, 0, 2, 1,
  0, 2, 1, 0, 2, 0, 1,
];

const WEEK_EVENT_PATTERN = [2, 1, 3, 1, 2, 1, 2];

function MonthViewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="hidden md:grid grid-cols-7 border-t border-border divide-x divide-border bg-muted/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Desktop skeleton grid */}
      <div className="hidden md:grid grid-cols-7 flex-1 border-t divide-x divide-border">
        {MONTH_EVENT_PATTERN.map((eventCount, index) => (
          <div
            key={index}
            className="min-h-[100px] border-b p-1.5"
          >
            <Skeleton className="w-6 h-6 rounded-full mb-1.5" />
            <div className="space-y-1">
              {Array.from({ length: eventCount }, (_, i) => (
                <Skeleton
                  key={i}
                  className="h-5 w-full rounded"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile skeleton list */}
      <div className="md:hidden p-3 space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-7 h-7 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2 pl-9">
              {Array.from({ length: 2 }, (_, j) => (
                <Skeleton key={j} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekViewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Desktop week headers */}
      <div className="hidden md:grid grid-cols-7 border-t border-border divide-x divide-border bg-muted/50">
        {WEEK_EVENT_PATTERN.map((_, day) => (
          <div key={day} className="px-2 py-2 text-center">
            <Skeleton className="h-3 w-8 mx-auto mb-1" />
            <Skeleton className="h-6 w-6 mx-auto rounded-full" />
          </div>
        ))}
      </div>

      {/* Desktop week grid */}
      <div className="hidden md:grid grid-cols-7 flex-1 border-t divide-x divide-border">
        {WEEK_EVENT_PATTERN.map((eventCount, day) => (
          <div key={day} className="p-2 space-y-1.5">
            {Array.from({ length: eventCount }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded" />
            ))}
          </div>
        ))}
      </div>

      {/* Mobile skeleton list */}
      <div className="md:hidden p-3 space-y-4">
        {WEEK_EVENT_PATTERN.map((eventCount, day) => (
          <div key={day}>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-7 h-7 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2 pl-9">
              {Array.from({ length: Math.min(eventCount, 2) || 1 }, (_, j) => (
                <Skeleton key={j} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayViewSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}
