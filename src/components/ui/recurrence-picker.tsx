"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WEEKDAYS,
  configToRRule,
  getPreviewDates,
  getRecurrenceDescription,
  type Frequency,
  type RecurrenceConfig,
} from "@/components/ui/recurrence-picker-utils";

interface RecurrencePickerProps {
  value?: RecurrenceConfig;
  onChange?: (config: RecurrenceConfig) => void;
  onRRuleChange?: (rrule: string) => void;
  startDate?: Date;
  endDate?: Date;
  className?: string;
}

// Returns ISO weekdays (0=Mon … 6=Sun) that have at least one occurrence
// between start and end. Iterates at most 7 days since all weekdays appear
// within any 7-day window.
function getAvailableWeekdays(start: Date, end: Date): Set<number> {
  const available = new Set<number>();
  const current = new Date(start);
  while (current <= end && available.size < 7) {
    available.add((current.getDay() + 6) % 7);
    current.setDate(current.getDate() + 1);
  }
  return available;
}

export function RecurrencePicker({
  value,
  onChange,
  onRRuleChange,
  startDate = new Date(),
  endDate,
  className,
}: RecurrencePickerProps) {
  const [config, setConfig] = React.useState<RecurrenceConfig>(
    value || {
      frequency: "WEEKLY",
      interval: 1,
      byDay: [startDate.getDay() === 0 ? 6 : startDate.getDay() - 1],
      startDate,
      endDate,
    }
  );

  const [previewDates, setPreviewDates] = React.useState<Date[]>([]);
  const onRRuleChangeRef = React.useRef(onRRuleChange);
  React.useEffect(() => {
    onRRuleChangeRef.current = onRRuleChange;
  });
  const lastEmittedRRule = React.useRef("");

  React.useEffect(() => {
    if (value) {
      setConfig((prev) => (configToRRule(value) === configToRRule(prev) ? prev : value));
    }
  }, [value]);

  React.useEffect(() => {
    const currentConfig = { ...config, startDate, endDate };
    setPreviewDates(getPreviewDates(currentConfig));
    const rrule = configToRRule(currentConfig);
    if (rrule !== lastEmittedRRule.current) {
      lastEmittedRRule.current = rrule;
      onRRuleChangeRef.current?.(rrule);
    }
  }, [config, startDate, endDate]);

  const updateConfig = React.useCallback(
    (updates: Partial<RecurrenceConfig>) => {
      const newConfig = { ...config, ...updates, startDate, endDate };
      setConfig(newConfig);
      onChange?.(newConfig);
      onRRuleChange?.(configToRRule(newConfig));
    },
    [config, startDate, endDate, onChange, onRRuleChange]
  );

  const toggleDay = (day: number) => {
    const newDays = config.byDay.includes(day)
      ? config.byDay.filter((d) => d !== day)
      : [...config.byDay, day].sort((a, b) => a - b);

    if (config.frequency === "WEEKLY" && newDays.length === 0) {
      return;
    }

    updateConfig({ byDay: newDays });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Frequency and Interval */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Repeat every</Label>
        <Input
          type="number"
          min={1}
          max={99}
          value={config.interval}
          onChange={(e) => updateConfig({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-16"
        />
        <Select
          value={config.frequency}
          onValueChange={(value: Frequency) => updateConfig({ frequency: value })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DAILY">day{config.interval > 1 ? "s" : ""}</SelectItem>
            <SelectItem value="WEEKLY">week{config.interval > 1 ? "s" : ""}</SelectItem>
            <SelectItem value="MONTHLY">month{config.interval > 1 ? "s" : ""}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Day selector for weekly recurrence */}
      {config.frequency === "WEEKLY" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Repeat on</Label>
          <div className="flex gap-2">
            {WEEKDAYS.map((day) => {
              const available = endDate ? getAvailableWeekdays(startDate, endDate) : null;
              const isDisabled = available !== null && !available.has(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  disabled={isDisabled}
                  title={
                    isDisabled ? `No ${day.label} falls within the selected date range` : undefined
                  }
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    config.byDay.includes(day.value)
                      ? "bg-primary text-primary-foreground"
                      : isDisabled
                        ? "cursor-not-allowed bg-muted/40 text-muted-foreground/40"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  {day.label.charAt(0)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-sm font-medium text-foreground">{getRecurrenceDescription(config)}</p>
        {startDate && endDate && (
          <p className="mt-1 text-xs text-muted-foreground">
            From {format(startDate, "MMM d, yyyy")} to {format(endDate, "MMM d, yyyy")}
          </p>
        )}
      </div>

      {/* Preview dates */}
      {previewDates.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4" />
            Upcoming dates ({previewDates.length > 10 ? "first 10" : previewDates.length}{" "}
            occurrences)
          </Label>
          <div className="max-h-32 overflow-y-auto rounded-md border bg-background p-2">
            <div className="grid grid-cols-2 gap-1 text-xs">
              {previewDates.map((date, i) => (
                <div key={i} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                  <span className="font-medium text-muted-foreground">{i + 1}.</span>
                  <span>{format(date, "EEE, MMM d, yyyy")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecurrencePicker;
