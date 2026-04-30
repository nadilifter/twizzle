import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  promoteFromWaitlist,
  attemptWaitlistCharge,
  finalizeWaitlistEnrollment,
} from "@/lib/waitlist-promotion";

vi.mock("@/lib/adyen", () => ({
  chargeSubscription: vi.fn(),
  calculateChargeAmounts: vi.fn(),
}));

vi.mock("@/lib/recurring-billing-service", () => ({
  calculateChargeAmounts: vi.fn(() =>
    Promise.resolve({ chargeTotal: 100, tax: 0, processingFee: 0 })
  ),
}));

vi.mock("@/lib/notification-service", () => ({
  executeNotificationByTrigger: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/date-utils", () => ({
  getTodayNoonUTC: vi.fn(() => new Date("2026-04-27T12:00:00Z")),
}));

import { chargeSubscription } from "@/lib/adyen";
import { executeNotificationByTrigger } from "@/lib/notification-service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTransaction() {
  vi.mocked(db.$transaction).mockImplementation(async (fn) => (fn as CallableFunction)(db));
}

function makeProgram(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Program",
    organizationId: "org-1",
    waitlistEnabled: true,
    waitlistAutoPromote: true,
    capacity: 10,
    hasCapacityRestriction: true,
    basePrice: null,
    perSessionPrice: null,
    pricingModel: "FLAT_RATE",
    billingInterval: "ONE_TIME",
    recurringPrice: null,
    ...overrides,
  };
}

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: "enroll-1",
    athleteId: "athlete-1",
    userId: "user-1",
    programId: "prog-1",
    status: "WAITLISTED",
    waitlistPaymentDeadline: null,
    waitlistChargeAttempts: 0,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// promoteFromWaitlist
// ---------------------------------------------------------------------------

describe("promoteFromWaitlist", () => {
  beforeEach(() => {
    mockTransaction();
    vi.mocked(db.$queryRaw).mockResolvedValue([]);
  });

  it("returns { promoted: false } when waitlistEnabled is false", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(
      makeProgram({ waitlistEnabled: false }) as never
    );
    const result = await promoteFromWaitlist("prog-1");
    expect(result).toEqual({ promoted: false });
  });

  it("returns { promoted: false } when waitlistAutoPromote is false", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(
      makeProgram({ waitlistAutoPromote: false }) as never
    );
    const result = await promoteFromWaitlist("prog-1");
    expect(result).toEqual({ promoted: false });
  });

  it("returns { promoted: false } when program is at capacity", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(makeProgram({ capacity: 2 }) as never);
    vi.mocked(db.enrollment.count).mockResolvedValueOnce(2);
    const result = await promoteFromWaitlist("prog-1");
    expect(result).toEqual({ promoted: false });
  });

  it("returns { promoted: false } when no waitlisted enrollment exists", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(
      makeProgram({ hasCapacityRestriction: false }) as never
    );
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce(null);
    const result = await promoteFromWaitlist("prog-1");
    expect(result).toEqual({ promoted: false });
  });

  it("promotes free program to ACTIVE inline and sends WAITLIST_OPENING", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(
      makeProgram({ hasCapacityRestriction: false, basePrice: 0 }) as never
    );
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce(makeEnrollment() as never);
    vi.mocked(db.programInstance.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    const result = await promoteFromWaitlist("prog-1");

    expect(result).toEqual({ promoted: true, athleteId: "athlete-1" });
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    );
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "WAITLIST_OPENING" })
    );
  });

  it("promotes paid program: sets WAITLIST_PAYMENT_PENDING and calls attemptWaitlistCharge", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(
      makeProgram({ hasCapacityRestriction: false, basePrice: 100 }) as never
    );
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce(makeEnrollment() as never);
    vi.mocked(db.programInstance.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    // attemptWaitlistCharge internals — idempotency check returns null, lock succeeds
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null); // no PAID invoice
    vi.mocked(db.enrollment.updateMany).mockResolvedValueOnce({ count: 1 } as never);
    vi.mocked(db.paymentMethod.findFirst).mockResolvedValueOnce({
      adyenTokenId: "token-1",
      shopperReference: "user-1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      adyenPlatformAccount: { storeReference: "store-1" },
    } as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null); // no DRAFT invoice
    vi.mocked(db.invoice.create).mockResolvedValueOnce({
      id: "inv-1",
      reference: "WL-enroll-1-1",
    } as never);
    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Authorised",
      pspReference: "psp-1",
    } as never);
    // inline finalization transaction
    vi.mocked(db.invoice.update).mockResolvedValue({} as never);
    vi.mocked(db.lineItem.create).mockResolvedValue({} as never);
    vi.mocked(db.payment.create).mockResolvedValueOnce({ id: "pay-1" } as never);
    vi.mocked(db.transaction.create).mockResolvedValue({} as never);

    const result = await promoteFromWaitlist("prog-1");

    expect(result).toEqual({ promoted: true, athleteId: "athlete-1" });
    expect(chargeSubscription).toHaveBeenCalled();
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "WAITLIST_OPENING" })
    );
  });

  it("sets 24h deadline and sends WAITLIST_PAYMENT_FAILED when charge fails", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(
      makeProgram({ hasCapacityRestriction: false, basePrice: 100 }) as never
    );
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce(makeEnrollment() as never);
    vi.mocked(db.programInstance.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);
    vi.mocked(db.enrollment.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValue(null); // no PAID, no DRAFT
    vi.mocked(db.paymentMethod.findFirst).mockResolvedValueOnce({
      adyenTokenId: "token-1",
      shopperReference: "user-1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      adyenPlatformAccount: { storeReference: "store-1" },
    } as never);
    vi.mocked(db.invoice.create).mockResolvedValueOnce({
      id: "inv-1",
      reference: "WL-enroll-1-1",
    } as never);
    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Refused",
      refusalReason: "Insufficient funds",
    } as never);
    vi.mocked(db.instanceRegistration.updateMany).mockResolvedValue({} as never);

    const result = await promoteFromWaitlist("prog-1");

    expect(result).toEqual({ promoted: true, athleteId: "athlete-1" });
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ waitlistPaymentDeadline: expect.any(Date) }),
      })
    );
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "WAITLIST_PAYMENT_FAILED" })
    );
  });

  it("promotes to ACTIVE without charging when price is null", async () => {
    vi.mocked(db.program.findUnique).mockResolvedValueOnce(
      makeProgram({
        hasCapacityRestriction: false,
        basePrice: null,
        perSessionPrice: null,
      }) as never
    );
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce(makeEnrollment() as never);
    vi.mocked(db.programInstance.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    const result = await promoteFromWaitlist("prog-1");

    expect(result.promoted).toBe(true);
    expect(chargeSubscription).not.toHaveBeenCalled();
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    );
  });
});

// ---------------------------------------------------------------------------
// attemptWaitlistCharge
// ---------------------------------------------------------------------------

describe("attemptWaitlistCharge", () => {
  const baseParams = {
    enrollmentId: "enroll-1",
    userId: "user-1",
    organizationId: "org-1",
    amount: 100,
    programName: "Test Program",
    athleteId: "athlete-1",
    programId: "prog-1",
    currentAttempts: 0,
  };

  beforeEach(() => {
    mockTransaction();
  });

  it("returns alreadyCharged=true and skips Adyen when PAID invoice exists", async () => {
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce({ id: "inv-paid" } as never);
    vi.mocked(db.transaction.findFirst).mockResolvedValueOnce({
      pspReference: "psp-existing",
    } as never);
    // finalizeWaitlistEnrollment internals
    vi.mocked(db.invoice.findUnique).mockResolvedValueOnce({
      id: "inv-paid",
      organizationId: "org-1",
      userId: "user-1",
      subtotal: 100,
      total: 100,
      reference: "WL-ref",
      status: "PAID",
    } as never);
    vi.mocked(db.invoice.update).mockResolvedValue({} as never);
    vi.mocked(db.lineItem.findFirst).mockResolvedValueOnce({ id: "li-1" } as never);
    vi.mocked(db.payment.findFirst).mockResolvedValueOnce({ id: "pay-1" } as never);
    vi.mocked(db.transaction.findFirst).mockResolvedValueOnce({ id: "tx-1" } as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    const result = await attemptWaitlistCharge(baseParams);

    expect(result).toEqual({ success: true, alreadyCharged: true });
    expect(chargeSubscription).not.toHaveBeenCalled();
  });

  it("returns error when concurrent attempt wins the optimistic lock", async () => {
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.paymentMethod.findFirst).mockResolvedValueOnce({
      adyenTokenId: "token-1",
      shopperReference: "user-1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      adyenPlatformAccount: { storeReference: "store-1" },
    } as never);
    vi.mocked(db.enrollment.updateMany).mockResolvedValueOnce({ count: 0 } as never);

    const result = await attemptWaitlistCharge(baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/concurrent/i);
    expect(chargeSubscription).not.toHaveBeenCalled();
  });

  it("returns error when no payment method exists", async () => {
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.enrollment.updateMany).mockResolvedValueOnce({ count: 1 } as never);
    vi.mocked(db.paymentMethod.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      adyenPlatformAccount: { storeReference: "store-1" },
    } as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.invoice.create).mockResolvedValueOnce({
      id: "inv-1",
      reference: "WL-1-1",
    } as never);

    const result = await attemptWaitlistCharge(baseParams);

    expect(result.success).toBe(false);
    expect(chargeSubscription).not.toHaveBeenCalled();
  });

  it("returns success and finalizes enrollment on Authorised charge", async () => {
    vi.mocked(db.invoice.findFirst)
      .mockResolvedValueOnce(null) // no PAID invoice
      .mockResolvedValueOnce(null); // no DRAFT invoice
    vi.mocked(db.enrollment.updateMany).mockResolvedValueOnce({ count: 1 } as never);
    vi.mocked(db.paymentMethod.findFirst).mockResolvedValueOnce({
      adyenTokenId: "token-1",
      shopperReference: "user-1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      adyenPlatformAccount: { storeReference: "store-1" },
    } as never);
    vi.mocked(db.invoice.create).mockResolvedValueOnce({
      id: "inv-1",
      reference: "WL-enroll-1-1",
    } as never);
    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Authorised",
      pspReference: "psp-new",
    } as never);
    vi.mocked(db.invoice.update).mockResolvedValue({} as never);
    vi.mocked(db.lineItem.create).mockResolvedValue({} as never);
    vi.mocked(db.payment.create).mockResolvedValueOnce({ id: "pay-1" } as never);
    vi.mocked(db.transaction.create).mockResolvedValue({} as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    const result = await attemptWaitlistCharge(baseParams);

    expect(result).toEqual({ success: true });
    expect(chargeSubscription).toHaveBeenCalledWith(
      "user-1",
      "token-1",
      expect.any(Number),
      "inv-1",
      expect.stringContaining("Test Program"),
      "store-1"
    );
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    );
  });

  it("returns failure without modifying enrollment on Refused charge", async () => {
    vi.mocked(db.invoice.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    vi.mocked(db.enrollment.updateMany).mockResolvedValueOnce({ count: 1 } as never);
    vi.mocked(db.paymentMethod.findFirst).mockResolvedValueOnce({
      adyenTokenId: "token-1",
      shopperReference: "user-1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      adyenPlatformAccount: { storeReference: "store-1" },
    } as never);
    vi.mocked(db.invoice.create).mockResolvedValueOnce({
      id: "inv-1",
      reference: "WL-enroll-1-1",
    } as never);
    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Refused",
      refusalReason: "Do not honor",
    } as never);

    const result = await attemptWaitlistCharge(baseParams);

    expect(result).toEqual({ success: false, error: "Do not honor" });
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it("reuses existing DRAFT invoice instead of creating a new one", async () => {
    vi.mocked(db.invoice.findFirst)
      .mockResolvedValueOnce(null) // no PAID invoice
      .mockResolvedValueOnce({ id: "draft-existing", reference: "WL-enroll-1-1" } as never); // DRAFT exists
    vi.mocked(db.enrollment.updateMany).mockResolvedValueOnce({ count: 1 } as never);
    vi.mocked(db.paymentMethod.findFirst).mockResolvedValueOnce({
      adyenTokenId: "token-1",
      shopperReference: "user-1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      adyenPlatformAccount: { storeReference: "store-1" },
    } as never);
    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Refused",
      refusalReason: "Declined",
    } as never);

    await attemptWaitlistCharge(baseParams);

    expect(db.invoice.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// finalizeWaitlistEnrollment
// ---------------------------------------------------------------------------

describe("finalizeWaitlistEnrollment", () => {
  const baseParams = {
    invoiceId: "inv-1",
    enrollmentId: "enroll-1",
    pspReference: "psp-1",
    programName: "Test Program",
  };

  beforeEach(() => {
    mockTransaction();
  });

  it("returns without throwing when invoice not found", async () => {
    vi.mocked(db.invoice.findUnique).mockResolvedValueOnce(null);
    await expect(finalizeWaitlistEnrollment(baseParams)).resolves.toBeUndefined();
  });

  it("creates all missing records and sets enrollment ACTIVE", async () => {
    vi.mocked(db.invoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      userId: "user-1",
      subtotal: 100,
      total: 100,
      reference: "WL-ref",
      status: "DRAFT",
    } as never);
    vi.mocked(db.invoice.update).mockResolvedValue({} as never);
    vi.mocked(db.lineItem.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.lineItem.create).mockResolvedValue({} as never);
    vi.mocked(db.payment.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.payment.create).mockResolvedValueOnce({ id: "pay-1" } as never);
    vi.mocked(db.transaction.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.transaction.create).mockResolvedValue({} as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    await finalizeWaitlistEnrollment(baseParams);

    expect(db.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAID" } })
    );
    expect(db.lineItem.create).toHaveBeenCalled();
    expect(db.payment.create).toHaveBeenCalled();
    expect(db.transaction.create).toHaveBeenCalled();
    expect(db.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          waitlistPaymentDeadline: null,
          waitlistChargeAttempts: 0,
        }),
      })
    );
  });

  it("is idempotent — skips creating records that already exist", async () => {
    vi.mocked(db.invoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      userId: "user-1",
      subtotal: 100,
      total: 100,
      reference: "WL-ref",
      status: "PAID",
    } as never);
    vi.mocked(db.invoice.update).mockResolvedValue({} as never);
    vi.mocked(db.lineItem.findFirst).mockResolvedValueOnce({ id: "li-1" } as never);
    vi.mocked(db.payment.findFirst).mockResolvedValueOnce({ id: "pay-1" } as never);
    vi.mocked(db.transaction.findFirst).mockResolvedValueOnce({ id: "tx-1" } as never);
    vi.mocked(db.enrollment.update).mockResolvedValue({} as never);

    await finalizeWaitlistEnrollment(baseParams);

    expect(db.invoice.update).not.toHaveBeenCalled(); // already PAID
    expect(db.lineItem.create).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
    expect(db.transaction.create).not.toHaveBeenCalled();
    // enrollment.update still called to ensure ACTIVE
    expect(db.enrollment.update).toHaveBeenCalled();
  });
});
