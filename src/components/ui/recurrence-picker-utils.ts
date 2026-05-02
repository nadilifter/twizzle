import { RRule, Weekday } from "rrule";
import { addDays } from "date-fns";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface RecurrenceConfig {
  frequency: Frequency;
  interval: number;
  byDay: number[]; // 0=Monday, 1=Tuesday, ... 6=Sunday (ISO weekday)
  startDate: Date;
  endDate?: Date;
  count?: number;
}

export const WEEKDAYS = [
  { label: "Mon", value: 0, rruleDay: RRule.MO },
  { label: "Tue", value: 1, rruleDay: RRule.TU },
  { label: "Wed", value: 2, rruleDay: RRule.WE },
  { label: "Thu", value: 3, rruleDay: RRule.TH },
  { label: "Fri", value: 4, rruleDay: RRule.FR },
  { label: "Sat", value: 5, rruleDay: RRule.SA },
  { label: "Sun", value: 6, rruleDay: RRule.SU },
];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
};

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

  if (config.frequency === "WEEKLY" && config.byDay.length > 0) {
    const weekdays = config.byDay.map((day) => WEEKDAYS[day].rruleDay);
    rruleOptions.byweekday = weekdays;
  }

  if (config.count) {
    rruleOptions.count = config.count;
  }

  const rule = new RRule(rruleOptions as ConstructorParameters<typeof RRule>[0]);

  return rule.toString().replace(/^RRULE:/, "");
}

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
    return {
      frequency: "WEEKLY",
      interval: 1,
      byDay: [0],
      startDate,
      endDate,
    };
  }
}

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
