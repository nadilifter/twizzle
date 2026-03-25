const RRULE_DAY_LABELS: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

const DAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/**
 * Extract BYDAY days from an RFC 5545 RRULE string and return a
 * human-readable label like "Mon, Wed, Fri". Returns null when the
 * rrule has no BYDAY clause or no recognized day codes.
 */
export function formatRRuleDays(rrule: string): string | null {
  const match = rrule.match(/BYDAY=([A-Z,]+)/);
  if (!match) return null;
  const days = match[1]
    .split(",")
    .filter((d) => d in RRULE_DAY_LABELS)
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  if (days.length === 0) return null;
  return days.map((d) => RRULE_DAY_LABELS[d]).join(", ");
}
