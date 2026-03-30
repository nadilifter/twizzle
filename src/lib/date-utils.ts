/**
 * Date utilities for consistent timezone handling
 *
 * Key principles:
 * 1. All dates are stored in UTC in the database
 * 2. Date-only inputs (no time component) should use noon UTC to avoid
 *    date shifts when converting to/from local timezones
 * 3. Date+time inputs should preserve the user's intended local time
 */

/**
 * Parse a date-only string (YYYY-MM-DD) and return a Date set to noon UTC.
 * This prevents date shifts when the date is displayed in timezones behind UTC.
 *
 * Example: "2026-01-23" becomes "2026-01-23T12:00:00.000Z"
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to noon UTC, or null if invalid
 */
export function parseDateOnly(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  // Match YYYY-MM-DD format
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    // Full ISO string or other format — extract the UTC date and normalize to noon
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0)
    );
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0));
}

/**
 * Parse a date+time input into a UTC Date.
 * Assumes the time is in the user's local timezone and converts to UTC.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timeString - Time string in HH:mm or HH:mm:ss format
 * @param timezoneOffset - Optional timezone offset in minutes (defaults to 0 for UTC)
 * @returns Date object in UTC
 */
export function parseDateTime(
  dateString: string,
  timeString: string,
  timezoneOffset: number = 0
): Date | null {
  if (!dateString || !timeString) return null;

  const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeString.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hours, minutes, seconds = "0"] = timeMatch;

  // Create local datetime
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  );

  // Adjust for timezone offset (convert from local to UTC)
  date.setMinutes(date.getMinutes() + timezoneOffset);

  return date;
}

/**
 * Format a Date for display as date-only (YYYY-MM-DD) in a specific timezone.
 *
 * @param date - Date object to format
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Formatted date string
 */
export function formatDateOnly(date: Date | string | null, timezone?: string): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  if (timezone) {
    return d.toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA gives YYYY-MM-DD format
  }

  // Default to ISO date part
  return d.toISOString().split("T")[0];
}

/**
 * Format a Date for display with time in a specific timezone.
 *
 * @param date - Date object to format
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Formatted datetime string
 */
export function formatDateTime(
  date: Date | string | null,
  timezone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  };

  if (timezone) {
    return d.toLocaleString("en-US", { ...defaultOptions, timeZone: timezone });
  }

  return d.toLocaleString("en-US", defaultOptions);
}

/**
 * Get today's date at noon UTC.
 * Useful for creating default dates that won't shift across timezones.
 */
export function getTodayNoonUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
}

/**
 * Check if two dates represent the same calendar day in UTC.
 */
export function isSameDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Normalize a potentially midnight UTC date to noon UTC.
 * This is useful for fixing existing data that was saved at midnight.
 */
export function normalizeToNoonUTC(date: Date | null): Date | null {
  if (!date) return null;

  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}
