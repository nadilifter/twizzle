import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/waitlist-promotion", () => ({
  promoteFromWaitlist: vi.fn(() => Promise.resolve({ promoted: false })),
}));

import { DELETE } from "../[enrollmentId]/route";
import { getAuthSession } from "@/lib/auth";
import { promoteFromWaitlist } from "@/lib/waitlist-promotion";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest() {
  return new NextRequest(
    new URL("/api/athletes/athlete-1/enrollments/enroll-1", "http://localhost:3000")
  );
}

function makeParams(athleteId = "athlete-1", enrollmentId = "enroll-1") {
  return { params: Promise.resolve({ id: athleteId, enrollmentId }) };
}

// ---------------------------------------------------------------------------
// Auth & access
// ---------------------------------------------------------------------------

describe("DELETE /api/athletes/[id]/enrollments/[enrollmentId] — auth", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not a guardian of the athlete", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({ user: { id: "user-1" } } as never);
    vi.mocked(db.athleteGuardian.findFirst).mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Status guard
// ---------------------------------------------------------------------------

describe("DELETE /api/athletes/[id]/enrollments/[enrollmentId] — status guard", () => {
  beforeEach(() => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.athleteGuardian.findFirst).mockResolvedValue({ id: "guardian-1" } as never);
  });

  it("returns 404 when enrollment is already CANCELLED", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce(null); // findFirst filters by cancellable statuses
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("cancels an ACTIVE enrollment and returns 200", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "ACTIVE",
      programId: "prog-1",
    } as never);
    vi.mocked(db.$transaction).mockImplementation(async (fn) => (fn as CallableFunction)(db));
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);
    vi.mocked(db.recurringCharge.updateMany).mockResolvedValue({} as never);

    const res = await DELETE(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) })
    );
  });

  it("cancels a WAITLISTED enrollment and returns 200", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "WAITLISTED",
      programId: "prog-1",
    } as never);
    vi.mocked(db.$transaction).mockImplementation(async (fn) => (fn as CallableFunction)(db));
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Spot-occupying cancellation → promotion
// ---------------------------------------------------------------------------

describe("DELETE /api/athletes/[id]/enrollments/[enrollmentId] — waitlist promotion", () => {
  beforeEach(() => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.athleteGuardian.findFirst).mockResolvedValue({ id: "guardian-1" } as never);
    vi.mocked(db.$transaction).mockImplementation(async (fn) => (fn as CallableFunction)(db));
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);
    vi.mocked(db.recurringCharge.updateMany).mockResolvedValue({} as never);
  });

  it("calls promoteFromWaitlist when cancelling ACTIVE enrollment", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "ACTIVE",
      programId: "prog-1",
    } as never);

    await DELETE(makeRequest(), makeParams());

    // promoteFromWaitlist is fire-and-forget — wait a tick for it to be called
    await new Promise((r) => setTimeout(r, 0));
    expect(promoteFromWaitlist).toHaveBeenCalledWith("prog-1");
  });

  it("calls promoteFromWaitlist when cancelling WAITLIST_PAYMENT_PENDING enrollment", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "WAITLIST_PAYMENT_PENDING",
      programId: "prog-1",
    } as never);

    await DELETE(makeRequest(), makeParams());

    await new Promise((r) => setTimeout(r, 0));
    expect(promoteFromWaitlist).toHaveBeenCalledWith("prog-1");
  });

  it("cancels RecurringCharges when enrollment was occupying a spot", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "ACTIVE",
      programId: "prog-1",
    } as never);

    await DELETE(makeRequest(), makeParams());

    expect(db.recurringCharge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } })
    );
  });

  it("does NOT call promoteFromWaitlist when cancelling WAITLISTED enrollment", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "WAITLISTED",
      programId: "prog-1",
    } as never);

    await DELETE(makeRequest(), makeParams());

    await new Promise((r) => setTimeout(r, 0));
    expect(promoteFromWaitlist).not.toHaveBeenCalled();
  });

  it("does NOT cancel RecurringCharges when cancelling WAITLISTED enrollment", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "WAITLISTED",
      programId: "prog-1",
    } as never);

    await DELETE(makeRequest(), makeParams());

    expect(db.recurringCharge.updateMany).not.toHaveBeenCalled();
  });

  it("still returns 200 even if promoteFromWaitlist throws", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enroll-1",
      status: "ACTIVE",
      programId: "prog-1",
    } as never);
    vi.mocked(promoteFromWaitlist).mockRejectedValueOnce(new Error("DB error"));

    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(200);
  });
});
