import { describe, expect, it } from "vitest";
import { formatOperatingHours } from "@/lib/operating-hours";

describe("formatOperatingHours", () => {
  it("returns Hours unavailable for an empty array", () => {
    expect(formatOperatingHours([])).toBe("Hours unavailable");
  });

  it("returns Hours unavailable when all entries have invalid days", () => {
    expect(formatOperatingHours([{ dayOfWeek: 9, openTime: "09:00", closeTime: "17:00" }])).toBe(
      "Hours unavailable"
    );
  });

  it("collapses Mon-Fri with same hours and shows Sat separately", () => {
    const hours = [
      { dayOfWeek: 1, openTime: "15:00", closeTime: "20:00" },
      { dayOfWeek: 2, openTime: "15:00", closeTime: "20:00" },
      { dayOfWeek: 3, openTime: "15:00", closeTime: "20:00" },
      { dayOfWeek: 4, openTime: "15:00", closeTime: "20:00" },
      { dayOfWeek: 5, openTime: "15:00", closeTime: "20:00" },
      { dayOfWeek: 6, openTime: "09:00", closeTime: "14:00" },
    ];
    expect(formatOperatingHours(hours)).toBe("Mon–Fri 3:00–8:00 PM · Sat 9:00 AM–2:00 PM");
  });

  it("collapses Tue-Thu when only those three days are present", () => {
    const hours = [
      { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00" },
    ];
    expect(formatOperatingHours(hours)).toBe("Tue–Thu 9:00 AM–5:00 PM");
  });

  it("formats Every day when all 7 days share identical hours", () => {
    const hours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      openTime: "10:00",
      closeTime: "18:00",
    }));
    expect(formatOperatingHours(hours)).toBe("Every day 10:00 AM–6:00 PM");
  });

  it("does not merge same-hours runs across a closed day", () => {
    const hours = [
      { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 5, openTime: "09:00", closeTime: "17:00" },
    ];
    expect(formatOperatingHours(hours)).toBe("Mon–Tue 9:00 AM–5:00 PM · Fri 9:00 AM–5:00 PM");
  });

  it("renders a single day on its own", () => {
    expect(formatOperatingHours([{ dayOfWeek: 6, openTime: "09:00", closeTime: "14:00" }])).toBe(
      "Sat 9:00 AM–2:00 PM"
    );
  });

  it("deduplicates duplicate day entries, keeping the first", () => {
    const hours = [
      { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 1, openTime: "10:00", closeTime: "20:00" },
    ];
    expect(formatOperatingHours(hours)).toBe("Mon 9:00 AM–5:00 PM");
  });

  it("handles midnight open and noon close", () => {
    expect(formatOperatingHours([{ dayOfWeek: 3, openTime: "00:00", closeTime: "12:00" }])).toBe(
      "Wed 12:00 AM–12:00 PM"
    );
  });

  it("falls back to placeholder when a time string is malformed", () => {
    expect(formatOperatingHours([{ dayOfWeek: 1, openTime: "abc:def", closeTime: "17:00" }])).toBe(
      "Mon --:-- AM–5:00 PM"
    );
  });

  it("keeps Sunday as its own group at the tail", () => {
    const hours = [
      { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 0, openTime: "11:00", closeTime: "16:00" },
    ];
    expect(formatOperatingHours(hours)).toBe("Mon 9:00 AM–5:00 PM · Sun 11:00 AM–4:00 PM");
  });
});
