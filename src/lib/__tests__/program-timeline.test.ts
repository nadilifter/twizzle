import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildProgramTimelineItems } from "../program-timeline";

describe("buildProgramTimelineItems", () => {
  beforeEach(() => {
    // Pin "now" to 2026-06-01 so isPast() comparisons are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("always includes the Program Created item first, not hollow", () => {
    const items = buildProgramTimelineItems({
      createdAt: "2026-01-15T10:00:00Z",
    });
    expect(items[0]?.title).toBe("Program Created");
    expect(items[0]?.hollow).toBe(false);
    expect(items[0]?.date?.toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });

  it("skips registration and schedule items when fields are missing", () => {
    const items = buildProgramTimelineItems({
      createdAt: "2026-01-15T10:00:00Z",
    });
    expect(items).toHaveLength(1);
  });

  it("emits all five items when every field is provided", () => {
    const items = buildProgramTimelineItems({
      createdAt: "2026-01-15T10:00:00Z",
      registrationStartDate: "2026-02-01",
      registrationStartTime: "09:00",
      registrationEndDate: "2026-05-01",
      registrationEndTime: "17:00",
      startDate: "2026-06-15",
      startTime: "10:00",
      endDate: "2026-08-15",
    });
    expect(items.map((i) => i.title)).toEqual([
      "Program Created",
      "Registration Opens",
      "Registration Closes",
      "Program Begins",
      "Program Ends",
    ]);
  });

  it("marks past milestones as filled and future ones as hollow", () => {
    const items = buildProgramTimelineItems({
      createdAt: "2026-01-15T10:00:00Z",
      registrationStartDate: "2026-02-01", // past
      registrationEndDate: "2026-05-01", // past
      startDate: "2026-06-15", // future (now is 2026-06-01)
      endDate: "2026-08-15", // future
    });
    const regOpen = items.find((i) => i.title === "Registration Opens");
    const regClose = items.find((i) => i.title === "Registration Closes");
    const begins = items.find((i) => i.title === "Program Begins");
    const ends = items.find((i) => i.title === "Program Ends");
    expect(regOpen?.hollow).toBe(false);
    expect(regClose?.hollow).toBe(false);
    expect(begins?.hollow).toBe(true);
    expect(ends?.hollow).toBe(true);
  });

  it("accepts Date instances as well as ISO strings", () => {
    const items = buildProgramTimelineItems({
      createdAt: new Date("2026-01-15T10:00:00Z"),
      startDate: new Date("2026-06-15T00:00:00Z"),
    });
    expect(items.map((i) => i.title)).toEqual(["Program Created", "Program Begins"]);
  });

  it("preserves optional times on registration and start items", () => {
    const items = buildProgramTimelineItems({
      createdAt: "2026-01-15T10:00:00Z",
      registrationStartDate: "2026-02-01",
      registrationStartTime: "09:00",
      startDate: "2026-06-15",
      startTime: "10:00",
      endDate: "2026-08-15",
    });
    expect(items.find((i) => i.title === "Registration Opens")?.time).toBe("09:00");
    expect(items.find((i) => i.title === "Program Begins")?.time).toBe("10:00");
    expect(items.find((i) => i.title === "Program Ends")?.time).toBeNull();
  });
});
