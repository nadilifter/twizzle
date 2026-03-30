import Holidays from "date-holidays";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/date-utils";
import type { HolidayType } from "@prisma/client";

export interface NationalHoliday {
  date: Date;
  name: string;
  year: number;
}

/**
 * Get public holidays for a country (and optionally state) for a given year.
 * Uses the `date-holidays` library with ISO 3166-1 alpha-2 country codes.
 */
export function getNationalHolidays(
  countryCode: string,
  stateCode: string | null | undefined,
  year: number
): NationalHoliday[] {
  const hd = stateCode
    ? new Holidays(countryCode, stateCode, { types: ["public"] })
    : new Holidays(countryCode, { types: ["public"] });

  const holidays = hd.getHolidays(year) || [];

  return holidays
    .filter((h) => h.type === "public")
    .map((h) => {
      const dateStr = h.date.split(" ")[0]; // "YYYY-MM-DD hh:mm:ss" → "YYYY-MM-DD"
      const [y, m, d] = dateStr.split("-").map(Number);
      return {
        date: new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)),
        name: h.name,
        year,
      };
    });
}

/**
 * Seed national holidays for an org/year if they don't already exist.
 * Called lazily on first access of a year's holidays.
 */
export async function seedHolidaysForYear(
  organizationId: string,
  countryCode: string,
  stateCode: string | null | undefined,
  year: number
): Promise<void> {
  const existingCount = await db.organizationHoliday.count({
    where: { organizationId, year, type: "NATIONAL" },
  });

  if (existingCount > 0) return;

  const holidays = getNationalHolidays(countryCode, stateCode, year);
  if (holidays.length === 0) return;

  await db.organizationHoliday.createMany({
    data: holidays.map((h) => ({
      organizationId,
      date: h.date,
      name: h.name,
      type: "NATIONAL" as HolidayType,
      isEnabled: true,
      year,
      countryCode,
      stateCode: stateCode || null,
    })),
    skipDuplicates: true,
  });
}

/**
 * Get enabled holiday dates for an org within a date range.
 * Returns a Set of "YYYY-MM-DD" strings for O(1) lookup.
 */
export async function getEnabledHolidayDates(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<Set<string>> {
  const holidays = await db.organizationHoliday.findMany({
    where: {
      organizationId,
      isEnabled: true,
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true },
  });

  return new Set(holidays.map((h) => formatDateOnly(h.date)));
}

/**
 * Filter out dates that fall on enabled holidays.
 */
export function filterOutHolidayDates(dates: Date[], holidayDateSet: Set<string>): Date[] {
  if (holidayDateSet.size === 0) return dates;
  return dates.filter((d) => !holidayDateSet.has(formatDateOnly(d)));
}
