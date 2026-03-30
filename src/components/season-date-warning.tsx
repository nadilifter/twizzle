"use client";

import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SeasonDateWarningProps {
  itemStartDate: Date | string | null | undefined;
  itemEndDate: Date | string | null | undefined;
  seasonStartDate: Date | string;
  seasonEndDate: Date | string;
  itemLabel?: string;
}

export function SeasonDateWarning({
  itemStartDate,
  itemEndDate,
  seasonStartDate,
  seasonEndDate,
  itemLabel = "item",
}: SeasonDateWarningProps) {
  if (!itemStartDate && !itemEndDate) return null;

  const sStart = new Date(seasonStartDate);
  const sEnd = new Date(seasonEndDate);
  const iStart = itemStartDate ? new Date(itemStartDate) : null;
  const iEnd = itemEndDate ? new Date(itemEndDate) : null;

  const startsBefore = iStart && iStart < sStart;
  const endsAfter = iEnd && iEnd > sEnd;

  if (!startsBefore && !endsAfter) return null;

  const seasonRange = `${format(sStart, "MMM d, yyyy")} – ${format(sEnd, "MMM d, yyyy")}`;

  let message: string;
  if (startsBefore && endsAfter) {
    message = `This ${itemLabel}'s dates extend beyond the selected season (${seasonRange}) on both ends.`;
  } else if (startsBefore) {
    message = `This ${itemLabel} starts before the selected season begins (${format(sStart, "MMM d, yyyy")}).`;
  } else {
    message = `This ${itemLabel} ends after the selected season ends (${format(sEnd, "MMM d, yyyy")}).`;
  }

  return (
    <Alert
      variant="destructive"
      className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 [&>svg]:text-amber-600"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
