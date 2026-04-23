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

function makeRequest() {
  return new NextRequest(new URL("/api/programs/p1/athletes", "http://localhost:3000"));
}

function makeParams() {
  return { params: Promise.resolve({ id: "p1" }) };
}

describe("GET /api/programs/[id]/athletes", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 when session has no organizationId", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { id: "u1", organizationId: null, permissions: [] },
    } as never);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when program is not in caller's organization", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);

    // Tenant isolation: the program lookup is scoped by organizationId.
    expect(db.program.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "p1", organizationId: "org-1" }),
      })
    );
  });

  it("returns deduped athletes with sessionCount for PER_INSTANCE programs", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({
      id: "p1",
      registrationType: "PER_INSTANCE",
      hasLevelRestriction: false,
      hasMembershipRestriction: false,
      hasWaiverRestriction: false,
      hasMedicalRequirement: false,
      requiredMemberships: [],
      waiverRequirements: [],
    } as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.instanceRegistration.findMany).mockResolvedValueOnce([
      {
        athleteId: "a1",
        programInstanceId: "s1",
        createdAt: new Date("2026-02-01"),
        athlete: {
          id: "a1",
          name: "Alice",
          firstName: "Alice",
          lastName: "A",
          avatar: null,
          email: "alice@ex.com",
          birthDate: null,
          gender: null,
          organizationAthletes: [],
        },
      },
      {
        athleteId: "a1",
        programInstanceId: "s2",
        createdAt: new Date("2026-02-08"),
        athlete: {
          id: "a1",
          name: "Alice",
          firstName: "Alice",
          lastName: "A",
          avatar: null,
          email: "alice@ex.com",
          birthDate: null,
          gender: null,
          organizationAthletes: [],
        },
      },
    ] as never);

    const res = await GET(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.registrationType).toBe("PER_INSTANCE");
    expect(json.athletes).toHaveLength(1);
    expect(json.athletes[0].id).toBe("a1");
    expect(json.athletes[0].sessionCount).toBe(2);
  });

  it("returns enrollment-based list for ALL_INSTANCES programs", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({
      id: "p1",
      registrationType: "ALL_INSTANCES",
      hasLevelRestriction: false,
      hasMembershipRestriction: false,
      hasWaiverRestriction: false,
      hasMedicalRequirement: false,
      requiredMemberships: [],
      waiverRequirements: [],
    } as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      {
        athleteId: "a1",
        status: "ACTIVE",
        createdAt: new Date("2026-01-15"),
        athlete: {
          id: "a1",
          name: "Alice",
          firstName: "Alice",
          lastName: "A",
          avatar: null,
          email: null,
          birthDate: null,
          gender: null,
          organizationAthletes: [],
        },
      },
    ] as never);
    vi.mocked(db.instanceRegistration.findMany).mockResolvedValueOnce([] as never);

    const res = await GET(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.athletes).toHaveLength(1);
    expect(json.athletes[0].status).toBe("ACTIVE");
    expect(json.athletes[0].sessionCount).toBe(0);
  });

  it("returns a requirements object reflecting hasXRestriction flags", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({
      id: "p1",
      registrationType: "ALL_INSTANCES",
      hasLevelRestriction: true,
      hasMembershipRestriction: false,
      hasWaiverRestriction: true,
      hasMedicalRequirement: true,
      requiredMemberships: [],
      waiverRequirements: [{ waiverId: "w1" }],
    } as never);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.instanceRegistration.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.level.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.waiverAcceptance.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.athleteMedicalInfo.findMany).mockResolvedValueOnce([] as never);

    const res = await GET(makeRequest(), makeParams());
    const json = await res.json();

    expect(json.requirements).toEqual({
      hasLevelRestriction: true,
      hasMembershipRestriction: false,
      hasWaiverRestriction: true,
      hasMedicalRequirement: true,
    });
  });
});
