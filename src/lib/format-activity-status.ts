/** Optional friendlier labels where title-casing alone is awkward. */
const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  // EventType (stored in activity `status` for event rows)
  CLASS: "Class",
  CLINIC: "Clinic",
  PARTY: "Party",
  TRYOUT: "Tryout",
  MEETING: "Meeting",
  OTHER: "Other",
};

/**
 * Formats raw enum / DB values (e.g. REGISTRATION_OPEN, IN_PROGRESS) for UI badges.
 * Event rows use `Event.type` (EventType) in the activity `status` field.
 */
export function formatActivityStatusLabel(raw: string): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  if (STATUS_LABEL_OVERRIDES[trimmed]) {
    return STATUS_LABEL_OVERRIDES[trimmed];
  }
  return trimmed
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
