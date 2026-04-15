"use client";

import { useState, useEffect } from "react";
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

const DISMISSED_KEY = "action-items-dismissed";

export function ActionItemsPanel({ data }: { data: ActionItemsResponse }) {
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data.allComplete && localStorage.getItem(DISMISSED_KEY) === "true") {
      setDismissed(true);
    }
    setHydrated(true);
  }, [data.allComplete]);

  if (!hydrated) return null;
  if (dismissed) return null;

  const incompleteCount = data.totalCount - data.completedCount;
  const progressPercent = Math.round((data.completedCount / data.totalCount) * 100);

  if (data.allComplete) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4 px-4">
          <PartyPopper className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <p className="flex-1 text-sm font-medium">All set! Setup complete.</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => {
              localStorage.setItem(DISMISSED_KEY, "true");
              setDismissed(true);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-6 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
            <Rocket className="h-4 w-4 sm:h-5 sm:w-5" />
            Getting Started
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {incompleteCount} remaining
          </Badge>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Progress value={progressPercent} className="h-1.5" />
          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
            {data.completedCount}/{data.totalCount}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-0">
        <ul className="space-y-0.5">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.url}
                className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                  item.isComplete ? "opacity-50" : ""
                }`}
              >
                {item.isComplete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  (() => {
                    const Icon = ICON_MAP[item.icon] ?? Calendar;
                    return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
                  })()
                )}
                <span className="flex-1 truncate">{item.title}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
