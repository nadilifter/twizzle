import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { GET } from "../route";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function authed() {
  vi.mocked(getAuthSession).mockResolvedValue({
    user: { id: "user-1", organizationId: "org-1", permissions: [] },
  } as never);
}

function makeRequest(view?: string) {
  const qs = view !== undefined ? `?view=${view}` : "";
  return new NextRequest(
    new URL(`/api/programs/p1/attendance-summary${qs}`, "http://localhost:3000")
  );
}

function makeParams() {
  return { params: Promise.resolve({ id: "p1" }) };
}

describe("GET /api/programs/[id]/attendance-summary", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid view", async () => {
    authed();
    const res = await GET(makeRequest("bogus"), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when program is not in caller's org", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce(null);
    const res = await GET(makeRequest("athlete"), makeParams());
    expect(res.status).toBe(404);
  });

  it("aggregates by athlete when view=athlete", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({ id: "p1" } as never);
    vi.mocked(db.instanceAttendance.findMany).mockResolvedValueOnce([
      {
        id: "a1",
        athleteId: "ath1",
        programInstanceId: "s1",
        status: "PRESENT",
        athlete: { id: "ath1", name: "Alice", avatar: null },
        programInstance: {
          id: "s1",
          date: new Date("2026-06-01"),
          startTime: "09:00",
          endTime: "10:00",
          status: "SCHEDULED",
        },
      },
      {
        id: "a2",
        athleteId: "ath1",
        programInstanceId: "s2",
        status: "ABSENT",
        athlete: { id: "ath1", name: "Alice", avatar: null },
        programInstance: {
          id: "s2",
          date: new Date("2026-06-08"),
          startTime: "09:00",
          endTime: "10:00",
          status: "SCHEDULED",
        },
      },
    ] as never);

    const res = await GET(makeRequest("athlete"), makeParams());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.view).toBe("athlete");
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0]).toMatchObject({
      athleteId: "ath1",
      present: 1,
      absent: 1,
      total: 2,
      percentage: 50,
    });
  });

  it("aggregates by session when view=session", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({ id: "p1" } as never);
    vi.mocked(db.instanceAttendance.findMany).mockResolvedValueOnce([
      {
        id: "a1",
        athleteId: "ath1",
        programInstanceId: "s1",
        status: "PRESENT",
        athlete: { id: "ath1", name: "Alice", avatar: null },
        programInstance: {
          id: "s1",
          date: new Date("2026-06-01"),
          startTime: "09:00",
          endTime: "10:00",
          status: "COMPLETED",
        },
      },
      {
        id: "a2",
        athleteId: "ath2",
        programInstanceId: "s1",
        status: "ABSENT",
        athlete: { id: "ath2", name: "Bob", avatar: null },
        programInstance: {
          id: "s1",
          date: new Date("2026-06-01"),
          startTime: "09:00",
          endTime: "10:00",
          status: "COMPLETED",
        },
      },
    ] as never);

    const res = await GET(makeRequest("session"), makeParams());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.view).toBe("session");
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0]).toMatchObject({
      instanceId: "s1",
      present: 1,
      absent: 1,
      total: 2,
    });
  });

  it("defaults to view=athlete when view param is missing", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({ id: "p1" } as never);
    vi.mocked(db.instanceAttendance.findMany).mockResolvedValueOnce([] as never);
    const res = await GET(makeRequest(), makeParams());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.view).toBe("athlete");
  });
});
