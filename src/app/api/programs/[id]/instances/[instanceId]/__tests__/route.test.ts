import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { GET } from "../route";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));
vi.mock("@/lib/notification-service", () => ({
  executeNotificationByTrigger: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function authed() {
  vi.mocked(getAuthSession).mockResolvedValue({
    user: { id: "user-1", organizationId: "org-1", permissions: [] },
  } as never);
}

function makeRequest() {
  return new NextRequest(new URL("/api/programs/p1/instances/s1", "http://localhost:3000"));
}
function makeParams() {
  return { params: Promise.resolve({ id: "p1", instanceId: "s1" }) };
}

describe("GET /api/programs/[id]/instances/[instanceId]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when instance is not in caller's organization", async () => {
    authed();
    vi.mocked(db.programInstance.findFirst).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect(db.programInstance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "s1",
          programId: "p1",
          organizationId: "org-1",
        }),
      })
    );
  });

  it("returns instance with registrations, attendances, evaluations, and same-day lesson plans", async () => {
    authed();
    const instanceDate = new Date("2026-06-01");
    vi.mocked(db.programInstance.findFirst).mockResolvedValueOnce({
      id: "s1",
      programId: "p1",
      date: instanceDate,
      registrations: [{ id: "r1" }],
      attendances: [{ id: "att1" }],
      evaluations: [{ id: "ev1" }],
    } as never);
    vi.mocked(db.lessonPlan.findMany).mockResolvedValueOnce([
      {
        id: "lp1",
        name: "Forward rolls",
        status: "ACTIVE",
        theme: null,
        notes: null,
        date: instanceDate,
      },
    ] as never);

    const res = await GET(makeRequest(), makeParams());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.id).toBe("s1");
    expect(json.registrations).toHaveLength(1);
    expect(json.attendances).toHaveLength(1);
    expect(json.evaluations).toHaveLength(1);
    expect(json.lessonPlans).toHaveLength(1);

    // lessonPlan query is scoped to the instance's date + this org
    expect(db.lessonPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: "p1",
          organizationId: "org-1",
          date: instanceDate,
        }),
      })
    );
  });
});
