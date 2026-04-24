"use client";

import * as React from "react";
import { RRule, Weekday } from "rrule";
import { format, addDays } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface RecurrenceConfig {
  frequency: Frequency;
  interval: number;
  byDay: number[]; // 0=Monday, 1=Tuesday, ... 6=Sunday (ISO weekday)
  startDate: Date;
  endDate?: Date;
  count?: number;
}

interface RecurrencePickerProps {
  value?: RecurrenceConfig;
  onChange?: (config: RecurrenceConfig) => void;
  onRRuleChange?: (rrule: string) => void;
  startDate?: Date;
  endDate?: Date;
  className?: string;
}

const WEEKDAYS = [
  { label: "Mon", value: 0, rruleDay: RRule.MO },
  { label: "Tue", value: 1, rruleDay: RRule.TU },
  { label: "Wed", value: 2, rruleDay: RRule.WE },
  { label: "Thu", value: 3, rruleDay: RRule.TH },
  { label: "Fri", value: 4, rruleDay: RRule.FR },
  { label: "Sat", value: 5, rruleDay: RRule.SA },
  { label: "Sun", value: 6, rruleDay: RRule.SU },
];

// Returns ISO weekdays (0=Mon … 6=Sun) that have at least one occurrence
// between start and end. Iterates at most 7 days since all weekdays appear
// within any 7-day window.
function getAvailableWeekdays(start: Date, end: Date): Set<number> {
  const available = new Set<number>();
  const current = new Date(start);
  while (current <= end && available.size < 7) {
    available.add((current.getDay() + 6) % 7); // JS Sunday=0 → ISO Monday=0
    current.setDate(current.getDate() + 1);
  }
  return available;
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
};

/**
 * Convert a RecurrenceConfig to an RRULE string
 */
export function configToRRule(config: RecurrenceConfig): string {
  const rruleOptions: Partial<ConstructorParameters<typeof RRule>[0]> = {
    freq:
      config.frequency === "DAILY"
        ? RRule.DAILY
        : config.frequency === "WEEKLY"
          ? RRule.WEEKLY
          : RRule.MONTHLY,
    interval: config.interval,
  };

  // Add byweekday for weekly recurrence
  if (config.frequency === "WEEKLY" && config.byDay.length > 0) {
    const weekdays = config.byDay.map((day) => WEEKDAYS[day].rruleDay);
    rruleOptions.byweekday = weekdays;
  }

  // Only add count; date range is handled by between() at the call site,
  // so UNTIL is omitted to avoid time-component mismatches at boundaries.
  if (config.count) {
    rruleOptions.count = config.count;
  }

  const rule = new RRule(rruleOptions as ConstructorParameters<typeof RRule>[0]);

  // Return just the RRULE part without DTSTART
  return rule.toString().replace(/^RRULE:/, "");
}

/**
 * Parse an RRULE string back to a RecurrenceConfig
 */
export function parseRRule(rruleString: string, startDate: Date, endDate?: Date): RecurrenceConfig {
  try {
    const rule = RRule.fromString(
      rruleString.startsWith("RRULE:") ? rruleString : `RRULE:${rruleString}`
    );

    const frequency: Frequency =
      rule.options.freq === RRule.DAILY
        ? "DAILY"
        : rule.options.freq === RRule.WEEKLY
          ? "WEEKLY"
          : "MONTHLY";

    const byDay: number[] = [];
    if (rule.options.byweekday) {
      const weekdays = Array.isArray(rule.options.byweekday)
        ? rule.options.byweekday
        : [rule.options.byweekday];

      weekdays.forEach((day) => {
        // Handle both Weekday objects and numbers
        const dayValue = typeof day === "number" ? day : (day as Weekday).weekday;
        byDay.push(dayValue);
      });
    }

    return {
      frequency,
      interval: rule.options.interval || 1,
      byDay,
      startDate,
      endDate: rule.options.until || endDate,
      count: rule.options.count || undefined,
    };
  } catch {
    // Return default config if parsing fails
    return {
      frequency: "WEEKLY",
      interval: 1,
      byDay: [0], // Monday
      startDate,
      endDate,
    };
  }
}

/**
 * Generate preview dates from an RRULE config
 */
export function getPreviewDates(config: RecurrenceConfig, maxDates = 10): Date[] {
  const rruleString = configToRRule(config);

  try {
    const y = config.startDate.getFullYear();
    const m = String(config.startDate.getMonth() + 1).padStart(2, "0");
    const d = String(config.startDate.getDate()).padStart(2, "0");
    const rule = RRule.fromString(`DTSTART:${y}${m}${d}T120000Z\nRRULE:${rruleString}`);
    const endDate = config.endDate || addDays(config.startDate, 365);
    const ey = endDate.getFullYear();
    const em = String(endDate.getMonth() + 1).padStart(2, "0");
    const ed = String(endDate.getDate()).padStart(2, "0");
    const startBound = new Date(`${y}-${m}-${d}T00:00:00Z`);
    const endBound = new Date(`${ey}-${em}-${ed}T23:59:59.999Z`);
    return rule.between(startBound, endBound, true).slice(0, maxDates);
  } catch {
    return [];
  }
}

/**
 * Get a human-readable description of the recurrence pattern
 */
export function getRecurrenceDescription(config: RecurrenceConfig): string {
  const { frequency, interval, byDay } = config;

  let base = "";
  if (interval === 1) {
    base = frequency === "DAILY" ? "Daily" : frequency === "WEEKLY" ? "Weekly" : "Monthly";
  } else {
    base = `Every ${interval} ${FREQUENCY_LABELS[frequency]}s`;
  }

  if (frequency === "WEEKLY" && byDay.length > 0) {
    const dayNames = byDay.map((d) => WEEKDAYS[d].label).join(", ");
    base += ` on ${dayNames}`;
  }

  return base;
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
      byDay: [startDate.getDay() === 0 ? 6 : startDate.getDay() - 1], // Convert JS day (0=Sun) to ISO (0=Mon)
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

  // Update config when value prop changes (bail out if rrule string is unchanged)
  React.useEffect(() => {
    if (value) {
      setConfig((prev) => (configToRRule(value) === configToRRule(prev) ? prev : value));
    }
  }, [value]);

  // Generate preview dates and emit RRULE whenever config or date range changes
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

    // Ensure at least one day is selected for weekly recurrence
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
