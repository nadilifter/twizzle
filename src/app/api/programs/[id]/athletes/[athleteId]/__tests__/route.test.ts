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
  return new NextRequest(new URL("/api/programs/p1/athletes/a1", "http://localhost:3000"));
}
function makeParams() {
  return { params: Promise.resolve({ id: "p1", athleteId: "a1" }) };
}

const baseProgram = {
  id: "p1",
  name: "Yoga",
  registrationType: "ALL_INSTANCES",
  hasLevelRestriction: false,
  hasMembershipRestriction: false,
  hasWaiverRestriction: false,
  hasMedicalRequirement: false,
  requiredMemberships: [],
  waiverRequirements: [],
};

const baseAthlete = {
  id: "a1",
  name: "Alice",
  firstName: "Alice",
  lastName: "Smith",
  email: "a@ex.com",
  avatar: null,
  birthDate: null,
  gender: null,
  organizationAthletes: [],
  guardians: [],
};

describe("GET /api/programs/[id]/athletes/[athleteId]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when program is not in caller's organization", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect(db.program.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "p1", organizationId: "org-1" }),
      })
    );
  });

  it("returns 404 when athlete is not in this program", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce(baseProgram as never);
    vi.mocked(db.athlete.findFirst).mockResolvedValueOnce(baseAthlete as never);
    vi.mocked(db.enrollment.count).mockResolvedValueOnce(0);
    vi.mocked(db.instanceRegistration.count).mockResolvedValueOnce(0);

    const res = await GET(makeRequest(), makeParams());
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not registered/i);
  });

  it("returns all program-scoped sections on happy path", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce(baseProgram as never);
    vi.mocked(db.athlete.findFirst).mockResolvedValueOnce(baseAthlete as never);
    vi.mocked(db.enrollment.count).mockResolvedValueOnce(1);
    vi.mocked(db.instanceRegistration.count).mockResolvedValueOnce(0);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      { id: "e1", status: "ACTIVE", startDate: null, endDate: null, createdAt: new Date() },
    ] as never);
    vi.mocked(db.instanceRegistration.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.instanceAttendance.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.evaluation.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.lineItem.findMany).mockResolvedValueOnce([] as never);

    const res = await GET(makeRequest(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.programName).toBe("Yoga");
    expect(json.athlete.id).toBe("a1");
    expect(json.enrollments).toHaveLength(1);
    expect(json.instanceRegistrations).toEqual([]);
    expect(json.attendances).toEqual([]);
    expect(json.evaluations).toEqual([]);
    expect(json.lineItems).toEqual([]);
    expect(json.compliance).toBeDefined();
    expect(json.requirements).toBeDefined();
  });

  it("scopes evaluations to programId OR programInstance.programId", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce(baseProgram as never);
    vi.mocked(db.athlete.findFirst).mockResolvedValueOnce(baseAthlete as never);
    vi.mocked(db.enrollment.count).mockResolvedValueOnce(1);
    vi.mocked(db.instanceRegistration.count).mockResolvedValueOnce(0);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.instanceRegistration.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.instanceAttendance.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.evaluation.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.lineItem.findMany).mockResolvedValueOnce([] as never);

    await GET(makeRequest(), makeParams());

    expect(db.evaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          athleteId: "a1",
          OR: expect.arrayContaining([
            expect.objectContaining({ programId: "p1" }),
            expect.objectContaining({ programInstance: { programId: "p1" } }),
          ]),
        }),
      })
    );
  });
});
