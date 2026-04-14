import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  generateMonthlyInvoices,
  processInvoicePayment,
  retryOutstandingInvoice,
  processDunningEmails,
  deactivateExpiredOrgs,
  recoverAndRetryStaleInvoices,
} from "@/lib/subscription-billing";

vi.mock("@/lib/adyen", () => ({
  chargeSubscription: vi.fn(),
  isAdyenConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/email", () => ({
  sendTemplatedEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/adyen-platform", () => ({
  registerAllowedOrigin: vi.fn(() => Promise.resolve()),
  removeAllowedOrigin: vi.fn(() => Promise.resolve()),
}));

import { chargeSubscription, isAdyenConfigured } from "@/lib/adyen";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateMonthlyInvoices", () => {
  it("creates invoices for active subscriptions", async () => {
    vi.mocked(db.organizationSubscription.findMany).mockResolvedValueOnce([
      {
        id: "sub-1",
        organizationId: "org-1",
        planId: "plan-1",
        billingCycle: "MONTHLY",
        plan: { monthlyPrice: 49.99, yearlyPrice: 499.99 },
        organization: { id: "org-1", slug: "acme" },
      },
    ] as never);

    vi.mocked(db.subscriptionInvoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([]);
    vi.mocked(db.subscriptionInvoice.create).mockResolvedValueOnce({} as never);

    const result = await generateMonthlyInvoices();

    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(db.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          amount: 49.99,
          status: "PENDING",
          currency: "USD",
        }),
      })
    );
  });

  it("skips orgs with existing invoices for the current period (idempotent)", async () => {
    vi.mocked(db.organizationSubscription.findMany).mockResolvedValueOnce([
      {
        id: "sub-1",
        organizationId: "org-1",
        planId: "plan-1",
        billingCycle: "MONTHLY",
        plan: { monthlyPrice: 49.99 },
        organization: { id: "org-1", slug: "acme" },
      },
    ] as never);

    vi.mocked(db.subscriptionInvoice.findFirst).mockResolvedValueOnce({
      id: "existing-inv",
    } as never);

    const result = await generateMonthlyInvoices();

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(db.subscriptionInvoice.create).not.toHaveBeenCalled();
  });

  it("skips zero-cost plans", async () => {
    vi.mocked(db.organizationSubscription.findMany).mockResolvedValueOnce([
      {
        id: "sub-1",
        organizationId: "org-1",
        planId: "plan-free",
        billingCycle: "MONTHLY",
        plan: { monthlyPrice: 0 },
        organization: { id: "org-1", slug: "acme" },
      },
    ] as never);

    const result = await generateMonthlyInvoices();

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("applies referral credit as a $0 PAID invoice and increments usage", async () => {
    vi.mocked(db.organizationSubscription.findMany).mockResolvedValueOnce([
      {
        id: "sub-1",
        organizationId: "org-1",
        planId: "plan-1",
        billingCycle: "MONTHLY",
        plan: { monthlyPrice: 49.99, yearlyPrice: 499.99 },
        organization: { id: "org-1", slug: "acme" },
      },
    ] as never);

    vi.mocked(db.subscriptionInvoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([
      {
        id: "ref-1",
        creditMonths: 3,
        creditMonthsUsed: 1,
        referredOrgName: "Referred Gym",
      },
    ]);
    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.subscriptionInvoice.create).mockResolvedValueOnce({} as never);
    vi.mocked(db.referral.update).mockResolvedValueOnce({} as never);

    const result = await generateMonthlyInvoices();

    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(db.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          amount: 0,
          status: "PAID",
          currency: "USD",
          notes: expect.stringContaining("Referred Gym"),
        }),
      })
    );
    expect(db.referral.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ref-1" },
        data: { creditMonthsUsed: { increment: 1 } },
      })
    );
  });

  it("divides yearly price by 12 for yearly billing cycle", async () => {
    vi.mocked(db.organizationSubscription.findMany).mockResolvedValueOnce([
      {
        id: "sub-1",
        organizationId: "org-1",
        planId: "plan-1",
        billingCycle: "YEARLY",
        plan: { monthlyPrice: 49.99, yearlyPrice: 480 },
        organization: { id: "org-1", slug: "acme" },
      },
    ] as never);

    vi.mocked(db.subscriptionInvoice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([]);
    vi.mocked(db.subscriptionInvoice.create).mockResolvedValueOnce({} as never);

    await generateMonthlyInvoices();

    expect(db.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 40 }),
      })
    );
  });
});

describe("processInvoicePayment", () => {
  beforeEach(() => {
    vi.mocked(isAdyenConfigured).mockReturnValue(true);
  });

  it("returns true for already-paid invoices without reprocessing", async () => {
    vi.mocked(db.subscriptionInvoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      status: "PAID",
      amount: 49.99,
      currency: "USD",
      organizationId: "org-1",
      organization: { organizationPaymentMethods: [] },
    } as never);

    const result = await processInvoicePayment("inv-1");
    expect(result).toBe(true);
    expect(chargeSubscription).not.toHaveBeenCalled();
  });

  it("atomically claims the invoice to prevent double-charge", async () => {
    vi.mocked(db.subscriptionInvoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      status: "PENDING",
      amount: 49.99,
      currency: "USD",
      reference: "SUB-INV-2026-04-acme",
      organizationId: "org-1",
      organization: {
        subscription: { adyenShopperReference: "shopper-1" },
        organizationPaymentMethods: [
          {
            id: "pm-1",
            isDefault: true,
            isActive: true,
            storedPaymentMethodId: "token-1",
            expiryMonth: "12",
            expiryYear: "2028",
          },
        ],
      },
    } as never);

    // Simulate another process already claimed the invoice
    vi.mocked(db.subscriptionInvoice.updateMany).mockResolvedValueOnce({
      count: 0,
    } as never);
    vi.mocked(db.subscriptionInvoice.findUnique).mockResolvedValueOnce({
      status: "PAID",
    } as never);

    const result = await processInvoicePayment("inv-1");
    expect(result).toBe(true);
    expect(chargeSubscription).not.toHaveBeenCalled();
  });

  it("charges via Adyen and marks invoice PAID on success", async () => {
    vi.mocked(db.subscriptionInvoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      status: "PENDING",
      amount: 49.99,
      currency: "USD",
      reference: "SUB-INV-2026-04-acme",
      organizationId: "org-1",
      organization: {
        subscription: { adyenShopperReference: "shopper-1" },
        organizationPaymentMethods: [
          {
            id: "pm-1",
            isDefault: true,
            isActive: true,
            storedPaymentMethodId: "token-1",
            expiryMonth: "12",
            expiryYear: "2028",
          },
        ],
      },
    } as never);

    vi.mocked(db.subscriptionInvoice.updateMany).mockResolvedValueOnce({
      count: 1,
    } as never);
    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Authorised",
      pspReference: "psp-123",
    } as never);
    vi.mocked(db.subscriptionPaymentAttempt.create).mockResolvedValueOnce({} as never);
    vi.mocked(db.subscriptionInvoice.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organization.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationSubscription.updateMany).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.findMany).mockResolvedValueOnce([]);

    const result = await processInvoicePayment("inv-1");

    expect(result).toBe(true);
    expect(chargeSubscription).toHaveBeenCalledWith(
      "shopper-1",
      "token-1",
      49.99,
      expect.stringContaining("SUB-INV-2026-04-acme"),
      expect.any(String)
    );
    expect(db.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID" }),
      })
    );
  });

  it("enters grace period when all payment methods fail", async () => {
    vi.mocked(db.subscriptionInvoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      status: "PENDING",
      amount: 49.99,
      currency: "USD",
      reference: "SUB-INV-2026-04-acme",
      organizationId: "org-1",
      organization: {
        subscription: { adyenShopperReference: "shopper-1" },
        organizationPaymentMethods: [
          {
            id: "pm-1",
            isDefault: true,
            isActive: true,
            storedPaymentMethodId: "token-1",
            expiryMonth: "12",
            expiryYear: "2028",
          },
        ],
      },
    } as never);

    vi.mocked(db.subscriptionInvoice.updateMany).mockResolvedValueOnce({
      count: 1,
    } as never);
    vi.mocked(chargeSubscription).mockResolvedValueOnce({
      resultCode: "Refused",
      refusalReason: "Insufficient funds",
    } as never);
    vi.mocked(db.subscriptionPaymentAttempt.create).mockResolvedValue({} as never);
    vi.mocked(db.subscriptionInvoice.update).mockResolvedValue({} as never);
    vi.mocked(db.organization.update).mockResolvedValue({} as never);
    vi.mocked(db.organizationSubscription.updateMany).mockResolvedValue({} as never);
    vi.mocked(db.organizationMember.findMany).mockResolvedValue([]);

    const result = await processInvoicePayment("inv-1");

    expect(result).toBe(false);
    expect(db.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
    expect(db.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduledDeactivationDate: expect.any(Date),
        }),
      })
    );
    expect(db.organizationSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAST_DUE" },
      })
    );
  });

  it("skips expired payment methods", async () => {
    vi.mocked(db.subscriptionInvoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      status: "PENDING",
      amount: 49.99,
      currency: "USD",
      reference: "SUB-INV-2026-04-acme",
      organizationId: "org-1",
      organization: {
        subscription: { adyenShopperReference: "shopper-1" },
        organizationPaymentMethods: [
          {
            id: "pm-expired",
            isDefault: true,
            isActive: true,
            storedPaymentMethodId: "token-expired",
            expiryMonth: "01",
            expiryYear: "2020",
          },
        ],
      },
    } as never);

    vi.mocked(db.subscriptionInvoice.updateMany).mockResolvedValueOnce({
      count: 1,
    } as never);
    vi.mocked(db.subscriptionInvoice.update).mockResolvedValue({} as never);
    vi.mocked(db.organization.update).mockResolvedValue({} as never);
    vi.mocked(db.organizationSubscription.updateMany).mockResolvedValue({} as never);
    vi.mocked(db.organizationMember.findMany).mockResolvedValue([]);

    const result = await processInvoicePayment("inv-1");

    expect(result).toBe(false);
    expect(chargeSubscription).not.toHaveBeenCalled();
  });

  it("returns false when Adyen is not configured", async () => {
    vi.mocked(isAdyenConfigured).mockReturnValue(false);

    vi.mocked(db.subscriptionInvoice.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      status: "PENDING",
      amount: 49.99,
      currency: "USD",
      reference: "ref",
      organizationId: "org-1",
      organization: {
        subscription: null,
        organizationPaymentMethods: [
          {
            id: "pm-1",
            isDefault: true,
            isActive: true,
            storedPaymentMethodId: "token-1",
          },
        ],
      },
    } as never);

    vi.mocked(db.subscriptionInvoice.updateMany).mockResolvedValueOnce({
      count: 1,
    } as never);

    const result = await processInvoicePayment("inv-1");
    expect(result).toBe(false);
    expect(chargeSubscription).not.toHaveBeenCalled();
  });
});

describe("deactivateExpiredOrgs", () => {
  it("deactivates orgs past their scheduled deactivation date", async () => {
    const yesterday = new Date(Date.now() - 86400000);

    vi.mocked(db.organization.findMany).mockResolvedValueOnce([
      {
        id: "org-1",
        name: "Expired Org",
        isActive: true,
        scheduledDeactivationDate: yesterday,
        subscription: { id: "sub-1" },
        websiteConfig: { subdomain: "expired-org" },
      },
    ] as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organization.update).mockResolvedValue({} as never);
    vi.mocked(db.organizationSubscription.update).mockResolvedValue({} as never);
    vi.mocked(db.organizationStatusLog.create).mockResolvedValue({} as never);
    vi.mocked(db.organizationMember.findMany).mockResolvedValue([]);

    const result = await deactivateExpiredOrgs();

    expect(result.deactivated).toBe(1);
    expect(db.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          deactivatedBy: "system",
          deactivationReason: "Non-payment",
        }),
      })
    );
    expect(db.organizationSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAUSED" },
      })
    );
  });
});

describe("recoverAndRetryStaleInvoices", () => {
  it("resets stuck PROCESSING invoices to PENDING", async () => {
    vi.mocked(db.subscriptionInvoice.findMany)
      .mockResolvedValueOnce([{ id: "stuck-1", reference: "ref-1" }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(db.subscriptionInvoice.update).mockResolvedValueOnce({} as never);

    const result = await recoverAndRetryStaleInvoices();

    expect(result.recovered).toBe(1);
    expect(db.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stuck-1" },
        data: { status: "PENDING" },
      })
    );
  });
});

describe("processDunningEmails", () => {
  it("sends warning emails at threshold days", async () => {
    const fiveDaysFromNow = new Date(Date.now() + 5 * 86400000);

    vi.mocked(db.organization.findMany).mockResolvedValueOnce([
      {
        id: "org-1",
        name: "Grace Org",
        scheduledDeactivationDate: fiveDaysFromNow,
        dunningWarningsSent: {},
      },
    ] as never);
    vi.mocked(db.organization.update).mockResolvedValue({} as never);
    vi.mocked(db.organizationMember.findMany).mockResolvedValue([
      { user: { email: "admin@example.com" } },
    ] as never);

    const result = await processDunningEmails();

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(db.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org-1" },
        data: expect.objectContaining({
          dunningWarningsSent: expect.objectContaining({ "7d": true }),
        }),
      })
    );
  });

  it("does not re-send already sent warnings", async () => {
    const fiveDaysFromNow = new Date(Date.now() + 5 * 86400000);

    vi.mocked(db.organization.findMany).mockResolvedValueOnce([
      {
        id: "org-1",
        name: "Grace Org",
        scheduledDeactivationDate: fiveDaysFromNow,
        dunningWarningsSent: { "30d": true, "7d": true },
      },
    ] as never);

    const result = await processDunningEmails();
    expect(result.sent).toBe(0);
  });
});
