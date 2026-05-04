import { describe, it, expect } from "vitest";
import {
  summarizeAttendanceByAthlete,
  summarizeAttendanceBySession,
  type AttendanceInput,
} from "../program-attendance-aggregation";

function makeAttendance(overrides: Partial<AttendanceInput> = {}): AttendanceInput {
  return {
    athleteId: "a1",
    programInstanceId: "s1",
    status: "PRESENT",
    athlete: { id: "a1", firstName: "Alice", lastName: "", avatar: null },
    programInstance: {
      id: "s1",
      date: new Date("2026-06-01T00:00:00Z"),
      startTime: "09:00",
      endTime: "10:00",
      status: "SCHEDULED",
    },
    ...overrides,
  };
}

describe("summarizeAttendanceByAthlete", () => {
  it("returns empty array when there are no records", () => {
    expect(summarizeAttendanceByAthlete([])).toEqual([]);
  });

  it("counts each status bucket per athlete", () => {
    const rows = summarizeAttendanceByAthlete([
      makeAttendance({ athleteId: "a1", programInstanceId: "s1", status: "PRESENT" }),
      makeAttendance({ athleteId: "a1", programInstanceId: "s2", status: "ABSENT" }),
      makeAttendance({ athleteId: "a1", programInstanceId: "s3", status: "LATE" }),
      makeAttendance({ athleteId: "a1", programInstanceId: "s4", status: "EXCUSED" }),
      makeAttendance({ athleteId: "a1", programInstanceId: "s5", status: "REGISTERED" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      athleteId: "a1",
      present: 1,
      absent: 1,
      late: 1,
      excused: 1,
      registered: 1,
      total: 5,
    });
  });

  it("computes percentage as (present + late) / (total - excused)", () => {
    const rows = summarizeAttendanceByAthlete([
      makeAttendance({ programInstanceId: "s1", status: "PRESENT" }),
      makeAttendance({ programInstanceId: "s2", status: "PRESENT" }),
      makeAttendance({ programInstanceId: "s3", status: "LATE" }),
      makeAttendance({ programInstanceId: "s4", status: "ABSENT" }),
    ]);
    // (2 present + 1 late) / (4 total - 0 excused) = 3/4 = 75%
    expect(rows[0].percentage).toBe(75);
  });

  it("excludes excused from the rate denominator (excused is neutral)", () => {
    const rows = summarizeAttendanceByAthlete([
      makeAttendance({ programInstanceId: "s1", status: "PRESENT" }),
      makeAttendance({ programInstanceId: "s2", status: "EXCUSED" }),
      makeAttendance({ programInstanceId: "s3", status: "EXCUSED" }),
    ]);
    // (1 present + 0 late) / (3 total - 2 excused) = 1/1 = 100%
    expect(rows[0].percentage).toBe(100);
  });

  it("returns 0% when denominator is 0 (all excused)", () => {
    const rows = summarizeAttendanceByAthlete([
      makeAttendance({ status: "EXCUSED" }),
      makeAttendance({ programInstanceId: "s2", status: "EXCUSED" }),
    ]);
    expect(rows[0].percentage).toBe(0);
  });

  it("buckets multiple athletes separately and sorts by name", () => {
    const rows = summarizeAttendanceByAthlete([
      makeAttendance({
        athleteId: "a1",
        athlete: { id: "a1", firstName: "Zara", lastName: "", avatar: null },
        status: "PRESENT",
      }),
      makeAttendance({
        athleteId: "a2",
        athlete: { id: "a2", firstName: "Alex", lastName: "", avatar: null },
        status: "ABSENT",
      }),
    ]);
    expect(rows.map((r) => r.athleteId)).toEqual(["a2", "a1"]);
  });
});

describe("summarizeAttendanceBySession", () => {
  it("returns empty array when there are no records", () => {
    expect(summarizeAttendanceBySession([])).toEqual([]);
  });

  it("buckets by session and counts each status", () => {
    const rows = summarizeAttendanceBySession([
      makeAttendance({ athleteId: "a1", programInstanceId: "s1", status: "PRESENT" }),
      makeAttendance({ athleteId: "a2", programInstanceId: "s1", status: "ABSENT" }),
      makeAttendance({ athleteId: "a1", programInstanceId: "s2", status: "LATE" }),
    ]);
    expect(rows).toHaveLength(2);
    const s1 = rows.find((r) => r.instanceId === "s1");
    const s2 = rows.find((r) => r.instanceId === "s2");
    expect(s1).toMatchObject({ present: 1, absent: 1, total: 2 });
    expect(s2).toMatchObject({ late: 1, total: 1 });
  });

  it("sorts sessions by date descending (most recent first)", () => {
    const rows = summarizeAttendanceBySession([
      makeAttendance({
        programInstanceId: "s-old",
        programInstance: {
          id: "s-old",
          date: new Date("2026-01-01T00:00:00Z"),
          startTime: "09:00",
          endTime: "10:00",
          status: "COMPLETED",
        },
      }),
      makeAttendance({
        programInstanceId: "s-new",
        programInstance: {
          id: "s-new",
          date: new Date("2026-06-01T00:00:00Z"),
          startTime: "09:00",
          endTime: "10:00",
          status: "SCHEDULED",
        },
      }),
    ]);
    expect(rows.map((r) => r.instanceId)).toEqual(["s-new", "s-old"]);
  });
});
