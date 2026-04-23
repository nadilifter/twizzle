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

function makeRequest(qs = "") {
  return new NextRequest(new URL(`/api/programs/p1/evaluations${qs}`, "http://localhost:3000"));
}
function makeParams() {
  return { params: Promise.resolve({ id: "p1" }) };
}

describe("GET /api/programs/[id]/evaluations", () => {
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

  it("scopes evaluations to programId OR programInstance.programId", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({ id: "p1" } as never);
    vi.mocked(db.evaluation.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(db.evaluation.count).mockResolvedValueOnce(0);

    await GET(makeRequest(), makeParams());

    expect(db.evaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ programId: "p1" }),
            expect.objectContaining({ programInstance: { programId: "p1" } }),
          ]),
        }),
        orderBy: { date: "desc" },
      })
    );
  });

  it("returns paginated shape with data + total + limit + offset", async () => {
    authed();
    vi.mocked(db.program.findFirst).mockResolvedValueOnce({ id: "p1" } as never);
    vi.mocked(db.evaluation.findMany).mockResolvedValueOnce([
      { id: "e1", date: new Date(), overallScore: 8 },
    ] as never);
    vi.mocked(db.evaluation.count).mockResolvedValueOnce(42);

    const res = await GET(makeRequest("?limit=10&offset=20"), makeParams());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        data: expect.any(Array),
        total: 42,
        limit: 10,
        offset: 20,
      })
    );
    expect(db.evaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
  });
});
