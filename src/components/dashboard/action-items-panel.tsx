"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  X,
  PartyPopper,
  Rocket,
  Users,
  Calendar,
  Globe,
  CreditCard,
  FolderOpen,
  GraduationCap,
  FileCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionItemsResponse } from "@/types/onboarding";

const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  Calendar,
  Globe,
  CreditCard,
  FolderOpen,
  GraduationCap,
  FileCheck,
};

export function ActionItemsPanelSkeleton() {
  return (
    <Card className="flex w-full flex-col">
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex w-full flex-1 items-center gap-3 rounded-lg border bg-card p-3"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ActionItemsPanel({
  data,
  onDismiss,
}: {
  data: ActionItemsResponse;
  onDismiss: () => void;
}) {
  const incompleteCount = data.totalCount - data.completedCount;
  const progressPercent = Math.round((data.completedCount / data.totalCount) * 100);

  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="px-6 pt-6 pb-3">
        {data.allComplete ? (
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <PartyPopper className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              All set! Setup complete.
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onDismiss}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                <Rocket className="h-4 w-4 sm:h-5 sm:w-5" />
                Getting Started
              </CardTitle>
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {incompleteCount} remaining
              </Badge>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Progress value={progressPercent} className="h-1.5" />
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {data.completedCount}/{data.totalCount}
              </span>
            </div>
          </>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-4 pb-4 pt-0">
        <ul className="flex flex-1 flex-col gap-2">
          {data.items.map((item) => (
            <li key={item.id} className="flex flex-1">
              <Link
                href={item.url}
                className="flex w-full flex-1 items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    item.isComplete ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"
                  }`}
                >
                  {item.isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    (() => {
                      const Icon = ICON_MAP[item.icon] ?? Calendar;
                      return <Icon className="h-4 w-4 text-muted-foreground" />;
                    })()
                  )}
                </div>
                <div className={`min-w-0 flex-1 ${item.isComplete ? "opacity-50" : ""}`}>
                  <div className="font-medium leading-tight">{item.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </div>
                </div>
                <ArrowRight
                  className={`h-4 w-4 shrink-0 text-muted-foreground ${item.isComplete ? "opacity-50" : ""}`}
                />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
