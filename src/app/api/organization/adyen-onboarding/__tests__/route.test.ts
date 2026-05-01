import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getAuthSession: vi.fn() }));

vi.mock("@/lib/adyen-platform", () => ({
  isPlatformConfigured: vi.fn(() => true),
  createLegalEntity: vi.fn(),
  createBusinessLine: vi.fn(),
  createAccountHolder: vi.fn(),
  createBalanceAccount: vi.fn(),
  getAccountHolder: vi.fn(),
  getLegalEntity: vi.fn(),
  createSweep: vi.fn(),
  getSweepSchedule: vi.fn(),
}));

vi.mock("@/lib/adyen-onboarding-status", () => ({
  deriveOnboardingStatus: vi.fn(() => "PENDING_HOSTED"),
  summarizeVerification: vi.fn(() => ""),
}));

vi.mock("@/lib/adyen-onboarding-recovery", () => ({
  handleVerificationRecovery: vi.fn(),
}));

vi.mock("@/lib/env-domains", () => ({
  getSubdomainUrl: vi.fn(() => "https://acme.example.com"),
}));

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import {
  isPlatformConfigured,
  createLegalEntity,
  createBusinessLine,
  createAccountHolder,
  createBalanceAccount,
  getAccountHolder,
  getLegalEntity,
  createSweep,
  getSweepSchedule,
} from "@/lib/adyen-platform";
import { deriveOnboardingStatus, summarizeVerification } from "@/lib/adyen-onboarding-status";
import { handleVerificationRecovery } from "@/lib/adyen-onboarding-recovery";
import { GET, POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isPlatformConfigured).mockReturnValue(true);
});

const VALID_ORG = {
  id: "org-1",
  name: "Acme",
  slug: "acme",
  street: "123 Main St",
  city: "San Francisco",
  stateProvince: "CA",
  postalCode: "94105",
  country: "US",
  phone: "+14155551212",
  email: "ops@acme.test",
  websiteConfig: { subdomain: "acme" },
};

const VALID_BODY = {
  legalNameConfirmed: true,
  platformAgreementAccepted: true,
  platformFeeAcknowledged: true,
};

function makeRequest(body: unknown = VALID_BODY) {
  return new NextRequest(new URL("/api/organization/adyen-onboarding", "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json" }),
  });
}

function authedSession() {
  vi.mocked(getAuthSession).mockResolvedValueOnce({
    user: { organizationId: "org-1", permissions: ["financials.create"] },
  } as never);
}

describe("POST /api/organization/adyen-onboarding", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(createLegalEntity).not.toHaveBeenCalled();
  });

  it("returns 403 without financials.create permission", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { organizationId: "org-1", permissions: [] },
    } as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(403);
    expect(createLegalEntity).not.toHaveBeenCalled();
  });

  it("returns 503 when the Adyen platform is not configured", async () => {
    authedSession();
    vi.mocked(isPlatformConfigured).mockReturnValueOnce(false);

    const res = await POST(makeRequest());

    expect(res.status).toBe(503);
  });

  it("returns the existing account when onboarding is already initiated", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      organizationId: "org-1",
      onboardingStatus: "VERIFIED",
      verificationStatus: "All capabilities verified",
      legalEntityId: "LE1",
      accountHolderId: "AH1",
      balanceAccountId: "BA1",
    } as never);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe("Onboarding already initiated");
    expect(json.account.legalEntityId).toBe("LE1");
    expect(createLegalEntity).not.toHaveBeenCalled();
  });

  it("returns 404 when the organization is missing", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(null as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
  });

  it("returns 400 when the organization address is incomplete", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      ...VALID_ORG,
      phone: null,
    } as never);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/address or phone number is incomplete/i);
    expect(createLegalEntity).not.toHaveBeenCalled();
  });

  it("returns 400 when state/country are not 2-letter codes", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      ...VALID_ORG,
      country: "USA",
    } as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(createLegalEntity).not.toHaveBeenCalled();
  });

  it("returns 400 when legalNameConfirmed is false", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(VALID_ORG as never);

    const res = await POST(makeRequest({ ...VALID_BODY, legalNameConfirmed: false }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/legal name/i);
    expect(createLegalEntity).not.toHaveBeenCalled();
  });

  it("returns 400 when platformAgreementAccepted is false", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(VALID_ORG as never);

    const res = await POST(makeRequest({ ...VALID_BODY, platformAgreementAccepted: false }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when platformFeeAcknowledged is false", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(VALID_ORG as never);

    const res = await POST(makeRequest({ ...VALID_BODY, platformFeeAcknowledged: false }));

    expect(res.status).toBe(400);
  });

  it("happy path: creates all four Adyen entities and persists the account", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(VALID_ORG as never);
    vi.mocked(createLegalEntity).mockResolvedValueOnce({ id: "LE1" } as never);
    vi.mocked(createBusinessLine).mockResolvedValueOnce({ id: "BL1" } as never);
    vi.mocked(createAccountHolder).mockResolvedValueOnce({ id: "AH1" } as never);
    vi.mocked(createBalanceAccount).mockResolvedValueOnce({ id: "BA1" } as never);
    vi.mocked(db.adyenPlatformAccount.create).mockResolvedValueOnce({
      onboardingStatus: "PENDING_HOSTED",
      legalEntityId: "LE1",
      accountHolderId: "AH1",
      balanceAccountId: "BA1",
      businessLineId: "BL1",
    } as never);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.account).toEqual({
      onboardingStatus: "PENDING_HOSTED",
      legalEntityId: "LE1",
      accountHolderId: "AH1",
      balanceAccountId: "BA1",
      businessLineId: "BL1",
    });

    // Order matters: LE → BL → AH → BA
    const orderOf = (mock: { mock: { invocationCallOrder: number[] } }) =>
      mock.mock.invocationCallOrder[0];
    expect(orderOf(vi.mocked(createLegalEntity))).toBeLessThan(
      orderOf(vi.mocked(createBusinessLine))
    );
    expect(orderOf(vi.mocked(createBusinessLine))).toBeLessThan(
      orderOf(vi.mocked(createAccountHolder))
    );
    expect(orderOf(vi.mocked(createAccountHolder))).toBeLessThan(
      orderOf(vi.mocked(createBalanceAccount))
    );

    expect(db.adyenPlatformAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        legalEntityId: "LE1",
        businessLineId: "BL1",
        accountHolderId: "AH1",
        balanceAccountId: "BA1",
        onboardingStatus: "PENDING_HOSTED",
        legalNameConfirmedAt: expect.any(Date),
        platformAgreementAcceptedAt: expect.any(Date),
        platformFeeAcknowledgedAt: expect.any(Date),
      }),
    });
  });

  it("recovers existing business line ID from a 422 ACQUIRING_BUSINESS_LINE duplicate", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(VALID_ORG as never);
    vi.mocked(createLegalEntity).mockResolvedValueOnce({ id: "LE1" } as never);

    const duplicateError = Object.assign(new Error("duplicate"), {
      statusCode: 422,
      responseBody: JSON.stringify({
        invalidFields: [
          {
            name: "ACQUIRING_BUSINESS_LINE",
            message: "duplicate business line",
            value: "BL-EXISTING",
          },
        ],
      }),
    });
    vi.mocked(createBusinessLine).mockRejectedValueOnce(duplicateError);
    vi.mocked(createAccountHolder).mockResolvedValueOnce({ id: "AH1" } as never);
    vi.mocked(createBalanceAccount).mockResolvedValueOnce({ id: "BA1" } as never);
    vi.mocked(db.adyenPlatformAccount.create).mockResolvedValueOnce({
      onboardingStatus: "PENDING_HOSTED",
      legalEntityId: "LE1",
      accountHolderId: "AH1",
      balanceAccountId: "BA1",
      businessLineId: "BL-EXISTING",
    } as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ businessLineId: "BL-EXISTING" }),
    });
  });

  it("returns 500 when Adyen fails mid-sequence and writes nothing to the DB (partial-state recovery is USC-152)", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(VALID_ORG as never);
    vi.mocked(createLegalEntity).mockResolvedValueOnce({ id: "LE1" } as never);
    vi.mocked(createBusinessLine).mockRejectedValueOnce(
      Object.assign(new Error("nope"), { statusCode: 500 })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(createAccountHolder).not.toHaveBeenCalled();
    expect(createBalanceAccount).not.toHaveBeenCalled();
    expect(db.adyenPlatformAccount.create).not.toHaveBeenCalled();
  });

  it.todo("saves partial state when Adyen fails mid-sequence (USC-152 — partial-state recovery)");
});

// ---------------------------------------------------------------------------
// GET /api/organization/adyen-onboarding — live-sync of capabilities,
// sweep auto-creation with 422 recovery, payout-schedule self-healing
// ---------------------------------------------------------------------------

describe("GET /api/organization/adyen-onboarding", () => {
  const ORG_FOR_GET = {
    id: "org-1",
    name: "Acme",
    street: "123 Main",
    city: "SF",
    stateProvince: "CA",
    postalCode: "94105",
    country: "US",
    phone: "+14155551212",
    taxRate: 0,
    taxEnabled: false,
    onboardingLegalNameConfirmedAt: null,
    onboardingFeeAcknowledgedAt: null,
    onboardingAgreementAcceptedAt: null,
    subscription: { plan: { transactionFee: 2.9, perTransactionFee: 30 } },
  };

  function authedGetSession() {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { organizationId: "org-1" },
    } as never);
  }

  // Most live-sync paths short-circuit when SKIP_ADYEN_LIVE_SYNC=true. Tests
  // that exercise live-sync should clear it; tests that don't care can leave
  // the default. We restore in afterEach to avoid leaking into POST tests.
  const ORIGINAL_SKIP = process.env.SKIP_ADYEN_LIVE_SYNC;
  beforeEach(() => {
    delete process.env.SKIP_ADYEN_LIVE_SYNC;
  });
  afterEach(() => {
    if (ORIGINAL_SKIP === undefined) delete process.env.SKIP_ADYEN_LIVE_SYNC;
    else process.env.SKIP_ADYEN_LIVE_SYNC = ORIGINAL_SKIP;
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns 400 when the organization has no active plan", async () => {
    authedGetSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      ...ORG_FOR_GET,
      subscription: null,
    } as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/no active plan/i);
  });

  it("returns account=null when no AdyenPlatformAccount exists", async () => {
    authedGetSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.account).toBeNull();
    expect(json.plan).toEqual({ transactionFee: 2.9, perTransactionFee: 30 });
    // No live-sync should have run — no account to reconcile against
    expect(getAccountHolder).not.toHaveBeenCalled();
    expect(getLegalEntity).not.toHaveBeenCalled();
  });

  it("live-sync: persists status change when Adyen reports a new onboarding status", async () => {
    authedGetSession();
    const stored = {
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: null,
      onboardingStatus: "AWAITING_DATA",
      verificationStatus: "stale",
      verifiedAt: null,
      capabilities: { old: true },
      payoutSchedule: null,
      transferInstrumentId: null,
      storeId: null,
    };
    const updated = { ...stored, onboardingStatus: "IN_REVIEW", verificationStatus: "fresh" };
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(stored as never);
    vi.mocked(getAccountHolder).mockResolvedValueOnce({
      capabilities: { fresh: true },
    } as never);
    vi.mocked(deriveOnboardingStatus).mockReturnValueOnce("IN_REVIEW" as never);
    vi.mocked(summarizeVerification).mockReturnValueOnce("fresh");
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce(updated as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(getAccountHolder).toHaveBeenCalledWith("AH1");
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { organizationId: "org-1", id: "ap-1" },
      data: {
        onboardingStatus: "IN_REVIEW",
        verificationStatus: "fresh",
        capabilities: { fresh: true },
      },
    });
    // verifiedAt should NOT be set here — onboardingStatus is IN_REVIEW, not VERIFIED
    expect(json.account.onboardingStatus).toBe("IN_REVIEW");
    expect(handleVerificationRecovery).not.toHaveBeenCalled();
  });

  it("live-sync: triggers handleVerificationRecovery when previously verified, regressed, then re-verifies", async () => {
    authedGetSession();
    const stored = {
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: "sweep-1",
      onboardingStatus: "AWAITING_DATA",
      verificationStatus: "stale",
      // verifiedAt set ⇒ this is a recovery, not a first-time verification
      verifiedAt: new Date("2026-01-01"),
      capabilities: {},
      payoutSchedule: "daily",
    };
    const reverified = { ...stored, onboardingStatus: "VERIFIED" };
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(stored as never);
    vi.mocked(getAccountHolder).mockResolvedValueOnce({ capabilities: {} } as never);
    vi.mocked(deriveOnboardingStatus).mockReturnValueOnce("VERIFIED" as never);
    vi.mocked(summarizeVerification).mockReturnValueOnce("All capabilities verified");
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce(reverified as never);
    vi.mocked(getSweepSchedule).mockResolvedValueOnce("daily" as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();

    expect(res.status).toBe(200);
    // Recovery hook fires because onboardingStatus changed from non-VERIFIED
    // back to VERIFIED with verifiedAt already set.
    expect(handleVerificationRecovery).toHaveBeenCalledOnce();
    expect(handleVerificationRecovery).toHaveBeenCalledWith(reverified);
  });

  it("live-sync: skipped when SKIP_ADYEN_LIVE_SYNC=true in non-prod", async () => {
    process.env.SKIP_ADYEN_LIVE_SYNC = "true";
    authedGetSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: "sweep-1",
      onboardingStatus: "VERIFIED",
      verifiedAt: new Date("2026-01-01"),
      capabilities: {},
      payoutSchedule: "daily",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(getAccountHolder).not.toHaveBeenCalled();
    expect(getLegalEntity).not.toHaveBeenCalled();
    expect(getSweepSchedule).not.toHaveBeenCalled();
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
  });

  it("live-sync: best-effort — Adyen API failure falls back to stored status", async () => {
    authedGetSession();
    const stored = {
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: "sweep-1",
      onboardingStatus: "AWAITING_DATA",
      verificationStatus: "stale",
      verifiedAt: null,
      capabilities: {},
      payoutSchedule: "daily",
    };
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(stored as never);
    vi.mocked(getAccountHolder).mockRejectedValueOnce(new Error("Adyen down"));
    vi.mocked(getSweepSchedule).mockResolvedValueOnce("daily" as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    // Stored status surfaces despite Adyen API failure
    expect(json.account.onboardingStatus).toBe("AWAITING_DATA");
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
  });

  it("sweep auto-create: VERIFIED + missing sweep + transfer instrument exists → creates sweep and writes IDs", async () => {
    authedGetSession();
    const stored = {
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: null,
      onboardingStatus: "VERIFIED",
      verificationStatus: "All capabilities verified",
      verifiedAt: new Date("2026-01-01"),
      capabilities: {},
      payoutSchedule: null,
      transferInstrumentId: null,
    };
    const withSweep = {
      ...stored,
      sweepId: "sweep-NEW",
      transferInstrumentId: "TI-1",
      payoutSchedule: "daily",
    };
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(stored as never);
    // Live-sync of holder status: keep status the same so no first update fires
    vi.mocked(getAccountHolder).mockResolvedValueOnce({ capabilities: {} } as never);
    vi.mocked(deriveOnboardingStatus).mockReturnValueOnce("VERIFIED" as never);
    vi.mocked(summarizeVerification).mockReturnValueOnce("All capabilities verified");
    // Sweep auto-create path
    vi.mocked(getLegalEntity).mockResolvedValueOnce({
      transferInstruments: [{ id: "TI-1" }],
    } as never);
    vi.mocked(createSweep).mockResolvedValueOnce({ id: "sweep-NEW" } as never);
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce(withSweep as never);
    // Schedule self-heal: same as written → no-op
    vi.mocked(getSweepSchedule).mockResolvedValueOnce("daily" as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(createSweep).toHaveBeenCalledWith("BA1", {
      counterparty: { transferInstrumentId: "TI-1" },
      category: "bank",
      type: "push",
      schedule: { type: "daily" },
      priorities: ["regular"],
      currency: "USD",
    });
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { organizationId: "org-1", id: "ap-1" },
      data: { sweepId: "sweep-NEW", transferInstrumentId: "TI-1", payoutSchedule: "daily" },
    });
    expect(json.account.hasSweep).toBe(true);
  });

  it("sweep auto-create: 422 'already exists' recovers the live sweep ID via regex (does NOT clobber payoutSchedule)", async () => {
    authedGetSession();
    const stored = {
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: null,
      onboardingStatus: "VERIFIED",
      verifiedAt: new Date("2026-01-01"),
      capabilities: {},
      // existing payoutSchedule must NOT be overwritten — Adyen owns it; the
      // separate schedule reconciler block reconciles it on the next read
      payoutSchedule: "weekly",
    };
    const recovered = { ...stored, sweepId: "sweep-RECOVERED", transferInstrumentId: "TI-1" };
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(stored as never);
    vi.mocked(getAccountHolder).mockResolvedValueOnce({ capabilities: {} } as never);
    vi.mocked(deriveOnboardingStatus).mockReturnValueOnce("VERIFIED" as never);
    vi.mocked(summarizeVerification).mockReturnValueOnce("All capabilities verified");
    vi.mocked(getLegalEntity).mockResolvedValueOnce({
      transferInstruments: [{ id: "TI-1" }],
    } as never);
    const dupErr = Object.assign(new Error("dup"), {
      statusCode: 422,
      apiError: { detail: "Sweep already exists: (sweep-RECOVERED)" },
    });
    vi.mocked(createSweep).mockRejectedValueOnce(dupErr);
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce(recovered as never);
    vi.mocked(getSweepSchedule).mockResolvedValueOnce("weekly" as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { organizationId: "org-1", id: "ap-1" },
      data: { sweepId: "sweep-RECOVERED", transferInstrumentId: "TI-1" },
    });
    // Critically: payoutSchedule must NOT appear in the recovery write
    const updateCall = vi.mocked(db.adyenPlatformAccount.update).mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(updateCall?.data).not.toHaveProperty("payoutSchedule");
  });

  it("sweep auto-create: skipped when no transfer instrument is attached yet", async () => {
    authedGetSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: null,
      onboardingStatus: "VERIFIED",
      verifiedAt: new Date("2026-01-01"),
      capabilities: {},
      payoutSchedule: null,
    } as never);
    vi.mocked(getAccountHolder).mockResolvedValueOnce({ capabilities: {} } as never);
    vi.mocked(deriveOnboardingStatus).mockReturnValueOnce("VERIFIED" as never);
    vi.mocked(summarizeVerification).mockReturnValueOnce("All capabilities verified");
    // No transfer instruments → sweep cannot be created yet
    vi.mocked(getLegalEntity).mockResolvedValueOnce({ transferInstruments: [] } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(createSweep).not.toHaveBeenCalled();
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
  });

  it("schedule self-heal: persists Adyen's sweep schedule when it diverges from the cached value", async () => {
    authedGetSession();
    const stored = {
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: "sweep-1",
      onboardingStatus: "VERIFIED",
      verifiedAt: new Date("2026-01-01"),
      capabilities: {},
      payoutSchedule: "weekly", // stale cache
    };
    const healed = { ...stored, payoutSchedule: "daily" };
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(stored as never);
    vi.mocked(getAccountHolder).mockResolvedValueOnce({ capabilities: {} } as never);
    vi.mocked(deriveOnboardingStatus).mockReturnValueOnce("VERIFIED" as never);
    vi.mocked(summarizeVerification).mockReturnValueOnce("All capabilities verified");
    // Adyen says daily, DB cached weekly → reconciler updates DB
    vi.mocked(getSweepSchedule).mockResolvedValueOnce("daily" as never);
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce(healed as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { organizationId: "org-1", id: "ap-1" },
      data: { payoutSchedule: "daily" },
    });
    expect(json.account.payoutSchedule).toBe("daily");
  });

  it("schedule self-heal: no DB write when Adyen schedule matches cached value", async () => {
    authedGetSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: "sweep-1",
      onboardingStatus: "VERIFIED",
      verifiedAt: new Date("2026-01-01"),
      capabilities: {},
      payoutSchedule: "daily",
    } as never);
    vi.mocked(getAccountHolder).mockResolvedValueOnce({ capabilities: {} } as never);
    vi.mocked(deriveOnboardingStatus).mockReturnValueOnce("VERIFIED" as never);
    vi.mocked(summarizeVerification).mockReturnValueOnce("All capabilities verified");
    vi.mocked(getSweepSchedule).mockResolvedValueOnce("daily" as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
  });

  it("response shape: serializes verifiedAt to ISO and exposes hasStore/hasSweep flags", async () => {
    process.env.SKIP_ADYEN_LIVE_SYNC = "true";
    authedGetSession();
    const verifiedAt = new Date("2026-02-15T10:30:00Z");
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      organizationId: "org-1",
      accountHolderId: "AH1",
      legalEntityId: "LE1",
      balanceAccountId: "BA1",
      sweepId: "sweep-1",
      storeId: "store-1",
      transferInstrumentId: "TI-1",
      onboardingStatus: "VERIFIED",
      verificationStatus: "All capabilities verified",
      capabilities: {},
      verifiedAt,
      payoutSchedule: "daily",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(ORG_FOR_GET as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.account).toEqual({
      onboardingStatus: "VERIFIED",
      verificationStatus: "All capabilities verified",
      capabilities: {},
      capabilityProblems: [],
      hasStore: true,
      hasSweep: true,
      payoutSchedule: "daily",
      legalEntityId: "LE1",
      accountHolderId: "AH1",
      balanceAccountId: "BA1",
      verifiedAt: verifiedAt.toISOString(),
      transferInstrumentId: "TI-1",
    });
  });
});
