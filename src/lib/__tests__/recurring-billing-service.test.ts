import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  executeRecurringCharge,
  extendEntitlement,
  suspendEntitlement,
  shouldTerminateCharge,
} from "@/lib/recurring-billing-service";

vi.mock("@/lib/adyen", () => ({
  chargeSubscription: vi.fn(),
}));

vi.mock("@/lib/date-utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getTodayNoonUTC: vi.fn(() => new Date("2026-04-04T12:00:00Z")),
  };
});

import { chargeSubscription } from "@/lib/adyen";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeCharge(overrides = {}): Parameters<typeof executeRecurringCharge>[0] {
  return {
    id: "charge-1",
    organizationId: "org-1",
    userId: "user-1",
    athleteId: null,
    description: "Monthly membership",
    amount: Object.assign(Object.create(null), {
      valueOf: () => 50,
      toString: () => "50",
    }) as never,
    frequency: "MONTHLY",
    nextChargeDate: new Date("2026-04-01T12:00:00Z"),
    paymentMethodId: "pm-1",
    athletePassId: null,
    athleteMembershipId: null,
    enrollmentId: null,
    paymentMethod: {
      id: "pm-1",
      type: "CARD",
      last4: "4242",
      brand: "visa",
      adyenTokenId: "adyen-token-1",
      shopperReference: "shopper-ref-1",
    },
    ...overrides,
  };
}

describe("executeRecurringCharge", () => {
  it("returns error when no payment method", async () => {
    const charge = makeCharge({ paymentMethodId: null, paymentMethod: null });
    const result = await executeRecurringCharge(charge, "org-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("No payment method");
  });

  it("returns error when Adyen token is missing", async () => {
    const charge = makeCharge({
      paymentMethod: {
        id: "pm-1",
        type: "CARD",
        last4: "4242",
        brand: "visa",
        adyenTokenId: null,
        shopperReference: null,
      },
    });
    const result = await executeRecurringCharge(charge, "org-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Payment method missing Adyen token");
  });

  it("generates deterministic reference to prevent double-charging", async () => {
    const charge = makeCharge();

    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce({
        taxEnabled: false,
        taxRate: 0,
        taxPaidBy: "CUSTOMER",
        subscription: { plan: { transactionFee: 0, perTransactionFee: 0 } },
      } as never)
      .mockResolvedValueOnce({
        adyenPlatformAccount: { storeReference: "store-ref-1" },
      } as never);

    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Authorised",
      pspReference: "psp-abc",
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      return (fn as CallableFunction)(db);
    });
    vi.mocked(db.invoice.create).mockResolvedValueOnce({
      id: "inv-1",
      reference: "REC-test",
    } as never);
    vi.mocked(db.lineItem.create).mockResolvedValueOnce({} as never);
    vi.mocked(db.payment.create).mockResolvedValueOnce({ id: "pay-1" } as never);
    vi.mocked(db.transaction.create).mockResolvedValueOnce({ id: "tx-1" } as never);

    const result = await executeRecurringCharge(charge, "org-1");

    expect(result.success).toBe(true);
    expect(chargeSubscription).toHaveBeenCalledWith(
      "shopper-ref-1",
      "adyen-token-1",
      50,
      "recurring-charge-1-2026-04-01",
      "Monthly membership",
      "store-ref-1"
    );
  });

  it("returns failure when Adyen refuses the charge", async () => {
    const charge = makeCharge();

    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce({
        taxEnabled: false,
        subscription: { plan: { transactionFee: 0, perTransactionFee: 0 } },
      } as never)
      .mockResolvedValueOnce({
        adyenPlatformAccount: { storeReference: "store-ref-1" },
      } as never);

    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Refused",
      refusalReason: "Insufficient funds",
    } as never);

    const result = await executeRecurringCharge(charge, "org-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient funds");
  });

  it("calculates tax when customer pays", async () => {
    const charge = makeCharge();

    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce({
        taxEnabled: true,
        taxRate: 0.08,
        taxPaidBy: "CUSTOMER",
        subscription: { plan: { transactionFee: 0.029, perTransactionFee: 0.3 } },
      } as never)
      .mockResolvedValueOnce({
        adyenPlatformAccount: { storeReference: "store-ref-1" },
      } as never);

    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Authorised",
      pspReference: "psp-tax",
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      return (fn as CallableFunction)(db);
    });
    vi.mocked(db.invoice.create).mockResolvedValueOnce({
      id: "inv-tax",
      reference: "REC-tax",
    } as never);
    vi.mocked(db.lineItem.create).mockResolvedValueOnce({} as never);
    vi.mocked(db.payment.create).mockResolvedValueOnce({ id: "pay-tax" } as never);
    vi.mocked(db.transaction.create).mockResolvedValueOnce({ id: "tx-tax" } as never);

    const result = await executeRecurringCharge(charge, "org-1");

    expect(result.success).toBe(true);
    // $50 base + $4 tax (8%) = $54 charged to customer
    expect(chargeSubscription).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      54,
      expect.any(String),
      expect.any(String),
      "store-ref-1"
    );
  });
});

describe("extendEntitlement", () => {
  it("extends athletePass endDate by one month for monthly charges", async () => {
    const charge = {
      id: "charge-1",
      organizationId: "org-1",
      frequency: "MONTHLY",
      athletePassId: "ap-1",
      athleteMembershipId: null,
      enrollmentId: null,
    };

    vi.mocked(db.athletePass.findFirst).mockResolvedValueOnce({
      id: "ap-1",
      endDate: new Date("2026-04-30T12:00:00Z"),
      status: "ACTIVE",
    } as never);
    vi.mocked(db.athletePass.update).mockResolvedValueOnce({} as never);

    await extendEntitlement(charge);

    expect(db.athletePass.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ap-1" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("extends athleteMembership endDate by one year for yearly charges", async () => {
    const charge = {
      id: "charge-2",
      organizationId: "org-1",
      frequency: "YEARLY",
      athletePassId: null,
      athleteMembershipId: "am-1",
      enrollmentId: null,
    };

    vi.mocked(db.athleteMembership.findFirst).mockResolvedValueOnce({
      id: "am-1",
      endDate: new Date("2026-12-31T12:00:00Z"),
      status: "ACTIVE",
    } as never);
    vi.mocked(db.athleteMembership.update).mockResolvedValueOnce({} as never);

    await extendEntitlement(charge);

    expect(db.athleteMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "am-1" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });
});

describe("suspendEntitlement", () => {
  it("suspends athletePass by setting status to EXPIRED", async () => {
    const charge = {
      id: "charge-1",
      organizationId: "org-1",
      athletePassId: "ap-1",
      athleteMembershipId: null,
      enrollmentId: null,
    };

    vi.mocked(db.athletePass.findFirst).mockResolvedValueOnce({
      id: "ap-1",
    } as never);
    vi.mocked(db.athletePass.update).mockResolvedValueOnce({} as never);

    await suspendEntitlement(charge);

    expect(db.athletePass.update).toHaveBeenCalledWith({
      where: { id: "ap-1" },
      data: { status: "EXPIRED" },
    });
  });

  it("suspends enrollment by setting status to PAUSED", async () => {
    const charge = {
      id: "charge-2",
      organizationId: "org-1",
      athletePassId: null,
      athleteMembershipId: null,
      enrollmentId: "enr-1",
    };

    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      id: "enr-1",
    } as never);
    vi.mocked(db.enrollment.update).mockResolvedValueOnce({} as never);

    await suspendEntitlement(charge);

    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: { status: "PAUSED" },
    });
  });
});

describe("shouldTerminateCharge", () => {
  it("terminates when enrollment is CANCELLED", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      status: "CANCELLED",
      endDate: null,
    } as never);

    const result = await shouldTerminateCharge({
      organizationId: "org-1",
      enrollmentId: "enr-1",
      athletePassId: null,
      athleteMembershipId: null,
    });

    expect(result).toBe(true);
  });

  it("terminates when enrollment no longer exists", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce(null);

    const result = await shouldTerminateCharge({
      organizationId: "org-1",
      enrollmentId: "enr-1",
      athletePassId: null,
      athleteMembershipId: null,
    });

    expect(result).toBe(true);
  });

  it("does not terminate for active enrollment", async () => {
    vi.mocked(db.enrollment.findFirst).mockResolvedValueOnce({
      status: "ACTIVE",
      endDate: null,
    } as never);

    const result = await shouldTerminateCharge({
      organizationId: "org-1",
      enrollmentId: "enr-1",
      athletePassId: null,
      athleteMembershipId: null,
    });

    expect(result).toBe(false);
  });

  it("terminates when athlete pass is ARCHIVED", async () => {
    vi.mocked(db.athletePass.findFirst).mockResolvedValueOnce({
      status: "ARCHIVED",
    } as never);

    const result = await shouldTerminateCharge({
      organizationId: "org-1",
      enrollmentId: null,
      athletePassId: "ap-1",
      athleteMembershipId: null,
    });

    expect(result).toBe(true);
  });
});
