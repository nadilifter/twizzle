import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";

// HMAC keys must be valid hex strings since the route does
// Buffer.from(hmacKey, "hex"). Lengths chosen to be plausible (32 bytes).
// Declared inside vi.hoisted so the env-var setup that depends on them runs
// before any module under test imports happen.
const { KEY_CONFIG, KEY_TRANSFER, KEY_NEGBAL, ORIGINAL_ENV } = vi.hoisted(() => {
  const KEY_CONFIG = "a".repeat(64);
  const KEY_TRANSFER = "b".repeat(64);
  const KEY_NEGBAL = "c".repeat(64);
  const ORIGINAL_ENV = {
    NODE_ENV: process.env.NODE_ENV,
    SKIP_WEBHOOK_HMAC: process.env.SKIP_WEBHOOK_HMAC,
    ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY: process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY,
    ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY: process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY,
    ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY: process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY,
  };
  process.env.NODE_ENV = "test";
  delete process.env.SKIP_WEBHOOK_HMAC;
  process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY = KEY_CONFIG;
  process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY = KEY_TRANSFER;
  process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY = KEY_NEGBAL;
  return { KEY_CONFIG, KEY_TRANSFER, KEY_NEGBAL, ORIGINAL_ENV };
});

afterAll(() => {
  // Restore env vars so vitest worker reuse doesn't leak HMAC keys into other files
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// scopedDb is a *separate* mockDeep instance from the unscoped `db`. This is
// what catches a regression where handleBankTransfer accidentally writes via
// raw `db.payout.create` instead of `scopedDb.payout.create` — the assertion
// would fail because the call landed on the wrong mock.
//
// Override @/lib/db to add getScopedDb (the shared mock only exports `db`).
// vi.importActual respects the vitest alias, so `actual.db` is the same
// mockDeep<PrismaClient>() instance the rest of the suite uses. The
// __scopedDbForTests escape hatch lets the test file grab a handle to the
// scoped mock (factory closure isn't otherwise reachable from tests).
vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<{ db: any }>("@/lib/db");
  const { mockDeep } = await import("vitest-mock-extended");
  const scopedDbInstance = mockDeep<typeof actual.db>();
  return {
    ...actual,
    getScopedDb: vi.fn(() => scopedDbInstance),
    __scopedDbForTests: scopedDbInstance,
  };
});

vi.mock("@/lib/adyen", () => ({
  extractHmacSignature: vi.fn(),
}));

vi.mock("@/lib/adyen-platform", () => ({
  getTransferInstrumentLast4: vi.fn(),
  getBalanceAccountSweepDescription: vi.fn(),
  setSweepStatus: vi.fn(),
  fetchPlatformPaymentTransfers: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/adyen-onboarding-recovery", () => ({
  handleVerificationRecovery: vi.fn(),
}));

vi.mock("@/lib/payout-utils", () => ({
  linkTransactionsToPayout: vi.fn(),
  determinePayoutType: vi.fn(() => "SWEEP"),
  mapTransferStatus: vi.fn((status: any) => {
    const code = typeof status === "string" ? status : status?.statusCode;
    if (code === "booked") return "PAID";
    if (code === "authorised" || code === "pendingApproval") return "SCHEDULED";
    if (code === "failed" || code === "returned") return "FAILED";
    return "PENDING";
  }),
}));

vi.mock("@/lib/notification-service", () => ({
  executeNotificationByTrigger: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { mockReset } from "vitest-mock-extended";
import * as dbModule from "@/lib/db";
import { db, getScopedDb } from "@/lib/db";
import { extractHmacSignature } from "@/lib/adyen";
import { setSweepStatus } from "@/lib/adyen-platform";
import { handleVerificationRecovery } from "@/lib/adyen-onboarding-recovery";
import { executeNotificationByTrigger } from "@/lib/notification-service";
import { POST } from "../route";

// Pulled out of the vi.mock factory closure via the __scopedDbForTests escape hatch.
const scopedDb = (dbModule as unknown as { __scopedDbForTests: ReturnType<typeof getScopedDb> })
  .__scopedDbForTests;

beforeEach(() => {
  vi.clearAllMocks();
  mockReset(scopedDb);
  process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY = KEY_CONFIG;
  process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY = KEY_TRANSFER;
  process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY = KEY_NEGBAL;
  delete process.env.SKIP_WEBHOOK_HMAC;
  process.env.NODE_ENV = "test";
});

function signWith(key: string, body: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(key, "hex"))
    .update(body, "utf-8")
    .digest("base64");
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(new URL("/api/webhooks/adyen-balance-platform", "http://localhost:3000"), {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json", ...headers }),
  });
}

// ---------------------------------------------------------------------------
// HMAC verification
// ---------------------------------------------------------------------------

describe("HMAC verification", () => {
  it("accepts a payload signed with the config key", async () => {
    const body = JSON.stringify({ type: "balancePlatform.unknown", data: {} });
    const sig = signWith(KEY_CONFIG, body);
    vi.mocked(extractHmacSignature).mockReturnValueOnce(sig);

    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
  });

  it("accepts a payload signed with the transfer key (key rotation)", async () => {
    const body = JSON.stringify({ type: "balancePlatform.unknown", data: {} });
    const sig = signWith(KEY_TRANSFER, body);
    vi.mocked(extractHmacSignature).mockReturnValueOnce(sig);

    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
  });

  it("rejects a tampered body with the original signature (401)", async () => {
    const original = JSON.stringify({ type: "balancePlatform.unknown", data: {} });
    const sig = signWith(KEY_CONFIG, original);
    const tampered = original.replace("unknown", "tampered");
    vi.mocked(extractHmacSignature).mockReturnValueOnce(sig);

    const res = await POST(makeRequest(tampered));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Invalid signature" });
  });

  it("rejects a payload signed with an unknown key (401)", async () => {
    const body = JSON.stringify({ type: "balancePlatform.unknown", data: {} });
    const sig = signWith("d".repeat(64), body);
    vi.mocked(extractHmacSignature).mockReturnValueOnce(sig);

    const res = await POST(makeRequest(body));

    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature header is missing", async () => {
    vi.mocked(extractHmacSignature).mockReturnValueOnce("");

    const res = await POST(makeRequest({ type: "balancePlatform.unknown", data: {} }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Missing signature" });
  });

  it("returns 500 when no HMAC keys are configured", async () => {
    delete process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY;
    delete process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY;
    delete process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY;
    vi.mocked(extractHmacSignature).mockReturnValueOnce("any");

    const res = await POST(makeRequest({ type: "balancePlatform.unknown", data: {} }));

    expect(res.status).toBe(500);
  });

  it("acknowledges standard notificationItems payloads without HMAC verification", async () => {
    const res = await POST(
      makeRequest({
        notificationItems: [
          {
            NotificationRequestItem: {
              eventCode: "AUTHORISATION",
              pspReference: "psp-1",
            },
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    expect(extractHmacSignature).not.toHaveBeenCalled();
  });

  it("skips HMAC verification when SKIP_WEBHOOK_HMAC=true in non-prod", async () => {
    process.env.SKIP_WEBHOOK_HMAC = "true";

    const res = await POST(makeRequest({ type: "balancePlatform.unknown", data: {} }));

    expect(res.status).toBe(200);
    expect(extractHmacSignature).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Helper: send a signed event payload
// ---------------------------------------------------------------------------

async function postSignedEvent(payload: unknown) {
  const body = JSON.stringify(payload);
  const sig = signWith(KEY_CONFIG, body);
  vi.mocked(extractHmacSignature).mockReturnValueOnce(sig);
  return POST(makeRequest(body));
}

// ---------------------------------------------------------------------------
// balancePlatform.accountHolder.updated
// ---------------------------------------------------------------------------

describe("balancePlatform.accountHolder.updated", () => {
  const allowedCapabilities = {
    sendToTransferInstrument: { allowed: true, verificationStatus: "valid" },
    receiveFromBalanceAccount: { allowed: true, verificationStatus: "valid" },
  };

  it("derives VERIFIED, sets verifiedAt, clears regressionErrors, and triggers recovery", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      id: "ap-1",
      organizationId: "org-1",
      onboardingStatus: "AWAITING_DATA",
      verifiedAt: null,
      balanceAccountId: "ba-1",
      sweepId: "sweep-1",
    } as never);
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce({} as never);

    const res = await postSignedEvent({
      type: "balancePlatform.accountHolder.updated",
      data: {
        accountHolder: {
          id: "AH123",
          status: "Active",
          capabilities: allowedCapabilities,
        },
      },
    });

    expect(res.status).toBe(200);
    // Lock the full update payload — catches regressions where extra fields
    // sneak into the write (e.g. accidental verifiedAt overwrite, or new
    // columns added without test coverage).
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { id: "ap-1" },
      data: {
        capabilities: allowedCapabilities,
        onboardingStatus: "VERIFIED",
        verificationStatus: "All capabilities verified",
        accountStatus: "ACTIVE",
        verifiedAt: expect.any(Date),
        regressionErrors: null,
      },
    });
    expect(handleVerificationRecovery).toHaveBeenCalledOnce();
  });

  it("regression: VERIFIED → AWAITING_DATA disables sweep, unpublishes website, stamps regressionAt", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      id: "ap-2",
      organizationId: "org-2",
      onboardingStatus: "VERIFIED",
      verifiedAt: new Date("2026-01-01"),
      balanceAccountId: "ba-2",
      sweepId: "sweep-2",
    } as never);
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.websiteConfig.updateMany).mockResolvedValueOnce({ count: 1 } as never);

    const res = await postSignedEvent({
      type: "balancePlatform.accountHolder.updated",
      data: {
        accountHolder: {
          id: "AH222",
          status: "Active",
          capabilities: {
            sendToTransferInstrument: {
              allowed: false,
              problems: [
                {
                  entity: { type: "LegalEntity" },
                  verificationErrors: [{ type: "dataMissing" }],
                },
              ],
            },
          },
        },
      },
    });

    expect(res.status).toBe(200);
    // Lock the full payload so a regression that, say, accidentally clears
    // verifiedAt or sets onboardingStatus back to VERIFIED would fail here.
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { id: "ap-2" },
      data: {
        capabilities: {
          sendToTransferInstrument: {
            allowed: false,
            problems: [
              {
                entity: { type: "LegalEntity" },
                verificationErrors: [{ type: "dataMissing" }],
              },
            ],
          },
        },
        onboardingStatus: "AWAITING_DATA",
        verificationStatus: "1 verification error(s) to resolve",
        accountStatus: "ACTIVE",
        regressionAt: expect.any(Date),
        regressionErrors: {
          sendToTransferInstrument: [{ type: "dataMissing" }],
        },
      },
    });
    expect(setSweepStatus).toHaveBeenCalledWith("ba-2", "sweep-2", "inactive");
    expect(db.websiteConfig.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-2", isPublished: true },
      data: { isPublished: false },
    });
    expect(handleVerificationRecovery).not.toHaveBeenCalled();
  });

  it("maps Suspended/Closed/Inactive holder status to accountStatus INACTIVE", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      id: "ap-3",
      organizationId: "org-3",
      onboardingStatus: "VERIFIED",
      verifiedAt: new Date(),
      balanceAccountId: null,
      sweepId: null,
    } as never);
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce({} as never);

    await postSignedEvent({
      type: "balancePlatform.accountHolder.updated",
      data: {
        accountHolder: {
          id: "AH333",
          status: "Suspended",
          capabilities: allowedCapabilities,
        },
      },
    });

    // Holder Suspended → INACTIVE. capabilities stay verified so onboarding
    // stays VERIFIED, but the platform-level accountStatus flips to INACTIVE.
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { id: "ap-3" },
      data: {
        capabilities: allowedCapabilities,
        onboardingStatus: "VERIFIED",
        verificationStatus: "All capabilities verified",
        accountStatus: "INACTIVE",
      },
    });
  });

  it("returns 200 and does not write when the accountHolderId is unknown", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce(null as never);

    const res = await postSignedEvent({
      type: "balancePlatform.accountHolder.updated",
      data: {
        accountHolder: { id: "UNKNOWN", capabilities: allowedCapabilities },
      },
    });

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
    expect(handleVerificationRecovery).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// balancePlatform.balanceAccount.{created,updated}
// ---------------------------------------------------------------------------

describe("balancePlatform.balanceAccount.* events", () => {
  it("acks and matches a known balance account without writing", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      id: "ap-1",
      organizationId: "org-1",
    } as never);

    const res = await postSignedEvent({
      type: "balancePlatform.balanceAccount.updated",
      data: { balanceAccount: { id: "ba-1" } },
    });

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
  });

  it("returns 200 for an unknown balance account", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce(null as never);

    const res = await postSignedEvent({
      type: "balancePlatform.balanceAccount.created",
      data: { balanceAccount: { id: "ba-unknown" } },
    });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// balancePlatform.transfer.{created,updated} (bank category → payout)
// ---------------------------------------------------------------------------

describe("balancePlatform.transfer.* (bank)", () => {
  function bankTransferEvent(overrides: Record<string, unknown> = {}) {
    return {
      type: "balancePlatform.transfer.updated",
      data: {
        transfer: {
          id: "TR-100",
          category: "bank",
          balanceAccountId: "ba-1",
          amount: { value: 12345, currency: "USD" },
          status: { statusCode: "booked" },
          createdAt: "2026-04-01T12:00:00Z",
          ...overrides,
        },
      },
    };
  }

  it("creates a new payout with status PAID and links transactions", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      organizationId: "org-1",
      sweepId: "sweep-1",
    } as never);
    // existingPayout lookup is org-scoped → on scopedDb
    scopedDb.payout.findFirst.mockResolvedValueOnce(null as never);
    scopedDb.payout.create.mockResolvedValueOnce({ id: "payout-1" } as never);
    // previousPayout lookup is unscoped (cross-org-id where clause) → on db.
    // Mocked explicitly so the test doesn't depend on the deep-mock default.
    vi.mocked(db.payout.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(db.payout.findUnique).mockResolvedValueOnce({
      amount: 123.45,
      fees: 0,
      net: 123.45,
    } as never);

    const { linkTransactionsToPayout } = await import("@/lib/payout-utils");

    const res = await postSignedEvent(bankTransferEvent());

    expect(res.status).toBe(200);
    expect(getScopedDb).toHaveBeenCalledWith("org-1");
    // Use toEqual to lock the full create payload — catches drift in shape
    // (e.g. unintended fields, missing payoutType, wrong amount conversion).
    expect(scopedDb.payout.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        reference: "TR-100",
        amount: 123.45,
        fees: 0,
        net: 123.45,
        currency: "USD",
        status: "PAID",
        payoutType: "SWEEP",
        bankAccount: null,
        paidAt: expect.any(Date),
      },
    });
    // Writes must NOT land on the unscoped db
    expect(db.payout.create).not.toHaveBeenCalled();
    expect(linkTransactionsToPayout).toHaveBeenCalledWith("payout-1", "org-1", undefined);
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        triggerType: "PAYOUT_PAID",
      })
    );
  });

  it("upgrades an existing SCHEDULED payout to PAID (status priority allows)", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      organizationId: "org-1",
      sweepId: null,
    } as never);
    scopedDb.payout.findFirst.mockResolvedValueOnce({
      id: "payout-existing",
      reference: "TR-100",
      status: "SCHEDULED",
      bankAccount: null,
    } as never);
    scopedDb.payout.update.mockResolvedValueOnce({} as never);
    vi.mocked(db.payout.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(db.payout.findUnique).mockResolvedValueOnce({
      amount: 123.45,
      fees: 0,
      net: 123.45,
    } as never);

    await postSignedEvent(bankTransferEvent());

    expect(getScopedDb).toHaveBeenCalledWith("org-1");
    expect(scopedDb.payout.update).toHaveBeenCalledWith({
      where: { id: "payout-existing" },
      data: {
        status: "PAID",
        payoutType: "SWEEP",
        paidAt: expect.any(Date),
      },
    });
    expect(scopedDb.payout.create).not.toHaveBeenCalled();
    expect(db.payout.update).not.toHaveBeenCalled();
  });

  it("does not downgrade a PAID payout when an out-of-order SCHEDULED arrives", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      organizationId: "org-1",
      sweepId: null,
    } as never);
    scopedDb.payout.findFirst.mockResolvedValueOnce({
      id: "payout-existing",
      reference: "TR-100",
      status: "PAID",
      bankAccount: null,
    } as never);
    scopedDb.payout.update.mockResolvedValueOnce({} as never);
    // Lock the reconciliation read explicitly: with isStatusTransition === false
    // the route MUST NOT call findUnique. If a refactor unconditionally reads
    // it, the assertion below will fail (rather than passing on the deep-mock
    // default of undefined).
    vi.mocked(db.payout.findUnique).mockImplementation(() => {
      throw new Error("payout.findUnique should not be called when status is unchanged");
    });

    await postSignedEvent(bankTransferEvent({ status: { statusCode: "authorised" } }));

    // Lock the full update payload: status must be absent (downgrade prevented),
    // scheduledAt set, no other fields drifting in.
    expect(scopedDb.payout.update).toHaveBeenCalledWith({
      where: { id: "payout-existing" },
      data: {
        payoutType: "SWEEP",
        scheduledAt: expect.any(Date),
      },
    });
    expect(executeNotificationByTrigger).not.toHaveBeenCalled();
    expect(db.payout.findUnique).not.toHaveBeenCalled();
  });

  it("triggers PAYOUT_FAILED with failureReason on a failed transfer", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      organizationId: "org-1",
      sweepId: null,
    } as never);
    scopedDb.payout.findFirst.mockResolvedValueOnce(null as never);
    scopedDb.payout.create.mockResolvedValueOnce({ id: "payout-fail" } as never);
    vi.mocked(db.payout.findUnique).mockResolvedValueOnce({
      amount: 123.45,
      fees: 0,
      net: 123.45,
    } as never);

    await postSignedEvent(
      bankTransferEvent({
        status: { statusCode: "failed" },
        reason: "bankAccountDetailsInvalid",
      })
    );

    expect(scopedDb.payout.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        reference: "TR-100",
        amount: 123.45,
        fees: 0,
        net: 123.45,
        currency: "USD",
        status: "FAILED",
        payoutType: "SWEEP",
        bankAccount: null,
        failureReason: "bankAccountDetailsInvalid",
      },
    });
    expect(db.payout.create).not.toHaveBeenCalled();
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "PAYOUT_FAILED" })
    );
  });

  it("ignores non-bank transfer categories", async () => {
    await postSignedEvent({
      type: "balancePlatform.transfer.updated",
      data: {
        transfer: {
          id: "TR-200",
          category: "platformPayment",
          balanceAccountId: "ba-1",
          amount: { value: 100, currency: "USD" },
          status: { statusCode: "booked" },
        },
      },
    });

    expect(getScopedDb).not.toHaveBeenCalled();
    expect(scopedDb.payout.create).not.toHaveBeenCalled();
    expect(scopedDb.payout.update).not.toHaveBeenCalled();
    expect(db.payout.create).not.toHaveBeenCalled();
    expect(db.payout.update).not.toHaveBeenCalled();
  });

  it("returns 200 when the balanceAccountId belongs to no known org", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce(null as never);

    const res = await postSignedEvent(bankTransferEvent());

    expect(res.status).toBe(200);
    // Without a matched org we must not even attempt to scope or write
    expect(getScopedDb).not.toHaveBeenCalled();
    expect(scopedDb.payout.create).not.toHaveBeenCalled();
    expect(db.payout.create).not.toHaveBeenCalled();
  });

  it("idempotency: a redelivered transfer.updated does not double-create or double-notify", async () => {
    // Adyen retries webhooks aggressively; replays must be safe. The route's
    // contract: same transferId on a second delivery must (a) match the
    // existing row by reference, (b) not create a duplicate Payout, and
    // (c) not fire another PAYOUT_PAID notification because the status is
    // unchanged (isStatusTransition is false when existing.status === incoming).

    // Delivery 1 — payout doesn't exist yet, gets created
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      organizationId: "org-1",
      sweepId: "sweep-1",
    } as never);
    scopedDb.payout.findFirst.mockResolvedValueOnce(null as never);
    scopedDb.payout.create.mockResolvedValueOnce({ id: "payout-1" } as never);
    vi.mocked(db.payout.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(db.payout.findUnique).mockResolvedValueOnce({
      amount: 123.45,
      fees: 0,
      net: 123.45,
    } as never);

    await postSignedEvent(bankTransferEvent());

    // Delivery 2 — same payload, payout already exists with status PAID
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      organizationId: "org-1",
      sweepId: "sweep-1",
    } as never);
    scopedDb.payout.findFirst.mockResolvedValueOnce({
      id: "payout-1",
      reference: "TR-100",
      status: "PAID",
      bankAccount: null,
    } as never);
    scopedDb.payout.update.mockResolvedValueOnce({} as never);
    vi.mocked(db.payout.findFirst).mockResolvedValueOnce(null as never);

    await postSignedEvent(bankTransferEvent());

    // No duplicate row: create runs exactly once across both deliveries
    expect(scopedDb.payout.create).toHaveBeenCalledTimes(1);
    // Second delivery converges via update (idempotent write of same status)
    expect(scopedDb.payout.update).toHaveBeenCalledTimes(1);
    expect(scopedDb.payout.update).toHaveBeenCalledWith({
      where: { id: "payout-1" },
      data: {
        status: "PAID",
        payoutType: "SWEEP",
        paidAt: expect.any(Date),
      },
    });
    // No double notification: PAYOUT_PAID fires only on the initial transition
    expect(executeNotificationByTrigger).toHaveBeenCalledTimes(1);
    expect(executeNotificationByTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "PAYOUT_PAID" })
    );
  });
});

// ---------------------------------------------------------------------------
// balancePlatform.negativeBalanceCompensationWarning.scheduled
// ---------------------------------------------------------------------------

describe("balancePlatform.negativeBalanceCompensationWarning.scheduled", () => {
  it("sends NEGATIVE_BALANCE_WARNING notification for a known org", async () => {
    vi.mocked(db.adyenPlatformAccount.findFirst).mockResolvedValueOnce({
      organizationId: "org-1",
    } as never);

    const res = await postSignedEvent({
      type: "balancePlatform.negativeBalanceCompensationWarning.scheduled",
      data: { balanceAccountId: "ba-1" },
    });

    expect(res.status).toBe(200);
    expect(executeNotificationByTrigger).toHaveBeenCalledWith({
      organizationId: "org-1",
      triggerType: "NEGATIVE_BALANCE_WARNING",
    });
  });
});

// ---------------------------------------------------------------------------
// Unknown event type
// ---------------------------------------------------------------------------

describe("unknown event types", () => {
  it("returns 200 and does not write for an unrecognized type", async () => {
    const res = await postSignedEvent({
      type: "balancePlatform.someUnknown.event",
      data: {},
    });

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
    expect(db.payout.create).not.toHaveBeenCalled();
  });
});
