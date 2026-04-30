import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.hoisted(() => {
  process.env.CRON_SECRET = "test-secret";
});

vi.mock("@/lib/waitlist-promotion", () => ({
  attemptWaitlistCharge: vi.fn(),
  finalizeWaitlistEnrollment: vi.fn(),
  promoteFromWaitlist: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  executeNotificationByTrigger: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "../waitlist-payment-check/route";
import {
  attemptWaitlistCharge,
  finalizeWaitlistEnrollment,
  promoteFromWaitlist,
} from "@/lib/waitlist-promotion";
import { executeNotificationByTrigger } from "@/lib/notification-service";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest(new URL("/api/cron/waitlist-payment-check", "http://localhost:3000"), {
    headers,
  } as never);
}

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: "enroll-1",
    userId: "user-1",
    athleteId: "athlete-1",
    programId: "prog-1",
    waitlistPaymentDeadline: null,
    waitlistChargeAttempts: 0,
    createdAt: new Date("2026-01-01"),
    program: {
      name: "Test Program",
      organizationId: "org-1",
      basePrice: 100,
      perSessionPrice: null,
      pricingModel: "FLAT_RATE",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("GET /api/cron/waitlist-payment-check — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const res = await GET(makeRequest({ authorization: "Bearer wrong-secret" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET env var is missing", async () => {
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(500);
    process.env.CRON_SECRET = original;
  });

  it("returns 200 with correct secret and no enrollments", async () => {
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([]);
    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ processed: 0, cancelled: 0, retried: 0, skipped: 0, errors: 0 });
  });
});

// ---------------------------------------------------------------------------
// Case 1 — Expired deadline
// ---------------------------------------------------------------------------

describe("GET /api/cron/waitlist-payment-check — expired deadline", () => {
  it("cancels enrollment, promotes next, sends expiry notification", async () => {
    const expiredDeadline = new Date(Date.now() - 1000);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ waitlistPaymentDeadline: expiredDeadline }),
    ] as never);
    vi.mocked(db.$transaction).mockImplementation(async (fn) => (fn as CallableFunction)(db));
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);
    vi.mocked(db.instanceRegistration.updateMany).mockResolvedValue({} as never);
    vi.mocked(promoteFromWaitlist).mockResolvedValueOnce({
      promoted: true,
      athleteId: "athlete-2",
    });

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.cancelled).toBe(1);
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) })
    );
    expect(promoteFromWaitlist).toHaveBeenCalledWith("prog-1");
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "WAITLIST_PAYMENT_EXPIRED" })
    );
  });
});

// ---------------------------------------------------------------------------
// Case 2 — Retry (active deadline, attempts < 3)
// ---------------------------------------------------------------------------

describe("GET /api/cron/waitlist-payment-check — retry with active deadline", () => {
  it("finalizes directly when a PAID invoice already exists", async () => {
    const futureDeadline = new Date(Date.now() + 86400000);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ waitlistPaymentDeadline: futureDeadline, waitlistChargeAttempts: 1 }),
    ] as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce({ id: "inv-paid" } as never);
    vi.mocked(db.transaction.findFirst).mockResolvedValueOnce({ pspReference: "psp-1" } as never);
    vi.mocked(finalizeWaitlistEnrollment).mockResolvedValueOnce(undefined);

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.processed).toBe(1);
    expect(finalizeWaitlistEnrollment).toHaveBeenCalled();
    expect(attemptWaitlistCharge).not.toHaveBeenCalled();
  });

  it("calls attemptWaitlistCharge and increments processed on success", async () => {
    const futureDeadline = new Date(Date.now() + 86400000);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ waitlistPaymentDeadline: futureDeadline, waitlistChargeAttempts: 1 }),
    ] as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(attemptWaitlistCharge).mockResolvedValueOnce({ success: true });

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.processed).toBe(1);
    expect(attemptWaitlistCharge).toHaveBeenCalled();
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "WAITLIST_OPENING" })
    );
  });

  it("increments retried on charge failure", async () => {
    const futureDeadline = new Date(Date.now() + 86400000);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ waitlistPaymentDeadline: futureDeadline, waitlistChargeAttempts: 1 }),
    ] as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(attemptWaitlistCharge).mockResolvedValueOnce({ success: false, error: "Declined" });

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.retried).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Case 2 — Stuck (no deadline)
// ---------------------------------------------------------------------------

describe("GET /api/cron/waitlist-payment-check — stuck enrollment (no deadline)", () => {
  it("retries and sets 24h deadline on charge failure", async () => {
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ waitlistPaymentDeadline: null }),
    ] as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(attemptWaitlistCharge).mockResolvedValueOnce({ success: false, error: "No PM" });
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.retried).toBe(1);
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ waitlistPaymentDeadline: expect.any(Date) }),
      })
    );
  });

  it("retries stuck enrollment regardless of attempt count", async () => {
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ waitlistPaymentDeadline: null, waitlistChargeAttempts: 5 }),
    ] as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(attemptWaitlistCharge).mockResolvedValueOnce({ success: true });

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(attemptWaitlistCharge).toHaveBeenCalled();
    expect(json.processed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Case 3 — Cap reached
// ---------------------------------------------------------------------------

describe("GET /api/cron/waitlist-payment-check — attempts capped", () => {
  it("skips enrollment when attempts >= 3 and deadline is active", async () => {
    const futureDeadline = new Date(Date.now() + 86400000);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ waitlistPaymentDeadline: futureDeadline, waitlistChargeAttempts: 3 }),
    ] as never);

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.skipped).toBe(1);
    expect(attemptWaitlistCharge).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Free / zero-amount enrollment
// ---------------------------------------------------------------------------

describe("GET /api/cron/waitlist-payment-check — free program", () => {
  it("skips enrollment with zero amount", async () => {
    const futureDeadline = new Date(Date.now() + 86400000);
    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({
        waitlistPaymentDeadline: futureDeadline,
        program: {
          name: "Free Program",
          organizationId: "org-1",
          basePrice: 0,
          perSessionPrice: null,
          pricingModel: "FLAT_RATE",
        },
      }),
    ] as never);

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.skipped).toBe(1);
    expect(attemptWaitlistCharge).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Summary counts across mixed enrollments
// ---------------------------------------------------------------------------

describe("GET /api/cron/waitlist-payment-check — mixed summary", () => {
  it("returns correct counts across expired, retried, and skipped enrollments", async () => {
    const future = new Date(Date.now() + 86400000);
    const past = new Date(Date.now() - 1000);

    vi.mocked(db.enrollment.findMany).mockResolvedValueOnce([
      makeEnrollment({ id: "e1", waitlistPaymentDeadline: past }), // expired → cancelled
      makeEnrollment({ id: "e2", waitlistPaymentDeadline: future, waitlistChargeAttempts: 1 }), // retry → success
      makeEnrollment({ id: "e3", waitlistPaymentDeadline: future, waitlistChargeAttempts: 3 }), // capped → skipped
    ] as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => (fn as CallableFunction)(db));
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);
    vi.mocked(db.instanceRegistration.updateMany).mockResolvedValue({} as never);
    vi.mocked(promoteFromWaitlist).mockResolvedValue({ promoted: false });
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(attemptWaitlistCharge).mockResolvedValueOnce({ success: true });

    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    const json = await res.json();

    expect(json.cancelled).toBe(1);
    expect(json.processed).toBe(1);
    expect(json.skipped).toBe(1);
  });
});
