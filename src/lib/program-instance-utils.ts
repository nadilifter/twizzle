import { RRule } from "rrule";
import { format, addMinutes } from "date-fns";

export function formatDtstartUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}T120000Z`;
}

export function generateInstanceDates(
  startDate: Date,
  endDate: Date,
  rruleString: string | null
): Date[] {
  if (!rruleString) {
    return [startDate];
  }

  try {
    const rruleWithDtstart = `DTSTART:${formatDtstartUTC(startDate)}\nRRULE:${rruleString}`;
    const rule = RRule.fromString(rruleWithDtstart);
    const startBound = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0));
    const endBound = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
    return rule.between(startBound, endBound, true);
  } catch (error) {
    console.error("Error parsing RRULE:", error);
    return [startDate];
  }
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startDateObj = new Date(2000, 0, 1, hours, minutes);
  const endDateObj = addMinutes(startDateObj, durationMinutes);
  return format(endDateObj, "HH:mm");
}
