import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { sendSingleSms } from "@/lib/sms-service";

vi.mock("@/lib/twilio", () => ({
  sendSms: vi.fn(() => Promise.resolve({ success: true, sid: "SM_test", status: "queued" })),
  calculateSegments: vi.fn(() => 1),
  normalizePhoneNumber: vi.fn((p: string) => p),
  isValidE164: vi.fn(() => true),
  mapTwilioStatus: vi.fn(() => "QUEUED"),
  isTwilioConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/sms-number-pool", () => ({
  getPoolNumberForSend: vi.fn(() => Promise.resolve("+15555550000")),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/feature-resolver", () => ({
  isFeatureEnabled: vi.fn(() => Promise.resolve(true)),
}));

import { logger } from "@/lib/logger";
import { sendSms } from "@/lib/twilio";

const USAGE_RECORD = {
  id: "usage-1",
  organizationId: "org-1",
  periodStart: new Date(),
  periodEnd: new Date(),
  messagesSent: 0,
  messagesDelivered: 0,
  messagesFailed: 0,
  totalSegments: 0,
  totalCost: 0,
  includedMessages: 1000,
  overageMessages: 0,
  overageCost: 0,
  rejectedNoConsent: 0,
  rejectedOptOut: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mockUsageRecordLookups() {
  // getOrCreateUsageRecord → organization.findUnique, then smsUsage.findUnique
  vi.mocked(db.organization.findUnique).mockResolvedValue({
    subscription: { plan: { smsIncluded: 1000, smsOverageRate: 0 } },
  } as never);
  vi.mocked(db.smsUsage.findUnique).mockResolvedValue(USAGE_RECORD as never);
  vi.mocked(db.smsUsage.update).mockResolvedValue(USAGE_RECORD as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUsageRecordLookups();
});

describe("sendSingleSms consent gate", () => {
  it("rejects with NO_CONSENT when user has no smsConsentAt and is not opted out", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      smsConsentAt: null,
      smsOptOut: false,
    } as never);

    const result = await sendSingleSms({
      organizationId: "org-1",
      to: "+15555551212",
      body: "hello",
      userId: "user-1",
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "NO_CONSENT",
    });
    expect(sendSms).not.toHaveBeenCalled();
    expect(db.message.create).not.toHaveBeenCalled();
    expect(db.smsUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { rejectedNoConsent: { increment: 1 } },
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "SMS send rejected",
      expect.objectContaining({ reason: "no_consent", userId: "user-1" })
    );
  });

  it("rejects with OPTED_OUT when smsOptOut is true (regardless of consent)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      smsConsentAt: new Date(),
      smsOptOut: true,
    } as never);

    const result = await sendSingleSms({
      organizationId: "org-1",
      to: "+15555551212",
      body: "hello",
      userId: "user-1",
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "OPTED_OUT",
    });
    expect(sendSms).not.toHaveBeenCalled();
    expect(db.smsUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { rejectedOptOut: { increment: 1 } },
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "SMS send rejected",
      expect.objectContaining({ reason: "opted_out", userId: "user-1" })
    );
  });

  it("proceeds to send when user has consent and is not opted out", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      smsConsentAt: new Date(),
      smsOptOut: false,
    } as never);
    vi.mocked(db.message.create).mockResolvedValueOnce({ id: "msg-1" } as never);
    vi.mocked(db.message.update).mockResolvedValueOnce({} as never);

    const result = await sendSingleSms({
      organizationId: "org-1",
      to: "+15555551212",
      body: "hello",
      userId: "user-1",
    });

    expect(result.success).toBe(true);
    expect(sendSms).toHaveBeenCalledOnce();
    expect(db.message.create).toHaveBeenCalledOnce();
  });

  it("skips the consent lookup when no userId is provided", async () => {
    vi.mocked(db.message.create).mockResolvedValueOnce({ id: "msg-1" } as never);
    vi.mocked(db.message.update).mockResolvedValueOnce({} as never);

    const result = await sendSingleSms({
      organizationId: "org-1",
      to: "+15555551212",
      body: "hello",
    });

    expect(result.success).toBe(true);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledOnce();
  });

  it("queries both smsConsentAt and smsOptOut in the user select", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      smsConsentAt: new Date(),
      smsOptOut: false,
    } as never);
    vi.mocked(db.message.create).mockResolvedValueOnce({ id: "msg-1" } as never);
    vi.mocked(db.message.update).mockResolvedValueOnce({} as never);

    await sendSingleSms({
      organizationId: "org-1",
      to: "+15555551212",
      body: "hello",
      userId: "user-1",
    });

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { smsConsentAt: true, smsOptOut: true },
    });
  });

  it("returns the rejection contract even when the audit-counter write throws", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      smsConsentAt: null,
      smsOptOut: false,
    } as never);
    vi.mocked(db.smsUsage.update).mockRejectedValueOnce(new Error("db down"));

    const result = await sendSingleSms({
      organizationId: "org-1",
      to: "+15555551212",
      body: "hello",
      userId: "user-1",
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "NO_CONSENT",
    });
    expect(sendSms).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "SMS rejection counter write failed",
      expect.objectContaining({ kind: "no_consent", error: "db down" })
    );
  });
});
