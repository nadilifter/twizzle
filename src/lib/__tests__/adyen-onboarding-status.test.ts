import { describe, it, expect } from "vitest";
import { AdyenOnboardingStatus } from "@prisma/client";
import { deriveOnboardingStatus, summarizeVerification } from "@/lib/adyen-onboarding-status";

type Capability = {
  allowed?: boolean;
  verificationStatus?: string;
  problems?: Array<{
    entity?: { type?: string };
    verificationErrors?: Array<{ type?: string }>;
  }>;
};

function holder(capabilities: Record<string, Capability>) {
  return { capabilities };
}

describe("deriveOnboardingStatus", () => {
  it("returns PENDING_HOSTED when there are no capabilities", () => {
    expect(deriveOnboardingStatus(holder({}))).toBe(AdyenOnboardingStatus.PENDING_HOSTED);
    expect(deriveOnboardingStatus({})).toBe(AdyenOnboardingStatus.PENDING_HOSTED);
  });

  it("returns VERIFIED when every capability is allowed and not invalid", () => {
    const ah = holder({
      sendToTransferInstrument: { allowed: true, verificationStatus: "valid" },
      receiveFromBalanceAccount: { allowed: true, verificationStatus: "valid" },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.VERIFIED);
  });

  it("does not return VERIFIED when an allowed capability is in the invalid grace period", () => {
    const ah = holder({
      sendToTransferInstrument: { allowed: true, verificationStatus: "invalid" },
      receiveFromBalanceAccount: { allowed: true, verificationStatus: "valid" },
    });
    expect(deriveOnboardingStatus(ah)).not.toBe(AdyenOnboardingStatus.VERIFIED);
  });

  it("returns REJECTED when any problem has a rejected verificationError", () => {
    const ah = holder({
      sendToTransferInstrument: {
        allowed: false,
        problems: [
          {
            entity: { type: "LegalEntity" },
            verificationErrors: [{ type: "rejected" }],
          },
        ],
      },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.REJECTED);
  });

  it("REJECTED takes priority over AWAITING_DATA when both signals are present", () => {
    const ah = holder({
      sendToTransferInstrument: {
        allowed: false,
        problems: [
          {
            entity: { type: "LegalEntity" },
            verificationErrors: [{ type: "dataMissing" }, { type: "rejected" }],
          },
        ],
      },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.REJECTED);
  });

  it("returns AWAITING_DATA for dataMissing on a LegalEntity", () => {
    const ah = holder({
      sendToTransferInstrument: {
        allowed: false,
        problems: [
          {
            entity: { type: "LegalEntity" },
            verificationErrors: [{ type: "dataMissing" }],
          },
        ],
      },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.AWAITING_DATA);
  });

  it("returns AWAITING_DATA for invalidInput on a LegalEntity", () => {
    const ah = holder({
      sendToTransferInstrument: {
        allowed: false,
        problems: [
          {
            entity: { type: "LegalEntity" },
            verificationErrors: [{ type: "invalidInput" }],
          },
        ],
      },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.AWAITING_DATA);
  });

  it("does not return AWAITING_DATA when dataMissing is on a non-LegalEntity entity", () => {
    const ah = holder({
      sendToTransferInstrument: {
        allowed: false,
        problems: [
          {
            entity: { type: "BankAccount" },
            verificationErrors: [{ type: "dataMissing" }],
          },
        ],
      },
    });
    expect(deriveOnboardingStatus(ah)).not.toBe(AdyenOnboardingStatus.AWAITING_DATA);
  });

  it("AWAITING_DATA wins over IN_REVIEW when both are present", () => {
    const ah = holder({
      sendToTransferInstrument: {
        allowed: false,
        verificationStatus: "pending",
        problems: [
          {
            entity: { type: "LegalEntity" },
            verificationErrors: [{ type: "dataMissing" }],
          },
        ],
      },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.AWAITING_DATA);
  });

  it("returns IN_REVIEW when a capability is pending and no problems require action", () => {
    const ah = holder({
      sendToTransferInstrument: { allowed: false, verificationStatus: "pending" },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.IN_REVIEW);
  });

  it("returns IN_PROGRESS as the fallback when no other branch matches", () => {
    const ah = holder({
      sendToTransferInstrument: { allowed: false, verificationStatus: "valid" },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.IN_PROGRESS);
  });

  it("returns IN_PROGRESS when a capability has an empty problems array", () => {
    const ah = holder({
      sendToTransferInstrument: {
        allowed: false,
        verificationStatus: "valid",
        problems: [],
      },
    });
    expect(deriveOnboardingStatus(ah)).toBe(AdyenOnboardingStatus.IN_PROGRESS);
  });
});

describe("summarizeVerification", () => {
  it('returns "No capabilities" for empty input', () => {
    expect(summarizeVerification(holder({}))).toBe("No capabilities");
    expect(summarizeVerification({})).toBe("No capabilities");
  });

  it("returns 'All capabilities verified' when every capability is allowed", () => {
    const ah = holder({
      a: { allowed: true },
      b: { allowed: true },
    });
    expect(summarizeVerification(ah)).toBe("All capabilities verified");
  });

  it("counts pending capabilities", () => {
    const ah = holder({
      a: { allowed: true },
      b: { allowed: false, verificationStatus: "pending" },
      c: { allowed: false, verificationStatus: "pending" },
    });
    expect(summarizeVerification(ah)).toBe("2/3 capabilities pending verification");
  });

  it("counts verification errors when nothing is pending", () => {
    const ah = holder({
      a: {
        allowed: false,
        problems: [
          {
            entity: { type: "LegalEntity" },
            verificationErrors: [{ type: "dataMissing" }, { type: "invalidInput" }],
          },
        ],
      },
      b: {
        allowed: false,
        problems: [
          {
            entity: { type: "LegalEntity" },
            verificationErrors: [{ type: "rejected" }],
          },
        ],
      },
    });
    expect(summarizeVerification(ah)).toBe("3 verification error(s) to resolve");
  });

  it("falls back to allowed-count summary when there are no problems and nothing pending", () => {
    const ah = holder({
      a: { allowed: true },
      b: { allowed: false, verificationStatus: "valid" },
    });
    expect(summarizeVerification(ah)).toBe("1/2 capabilities allowed");
  });
});
