import { describe, it, expect } from "vitest";
import {
  PRIVACY_POLICY_URL,
  SMS_CONSENT_LABEL_TEXT,
  TERMS_OF_SERVICE_URL,
} from "../sms-consent-copy";

/**
 * These tests protect the Twilio TFV submission. The toll-free verification
 * reviewer loads our live signup URLs and compares the on-page consent language
 * against the `AdditionalInformation` field of the TFV submission. If any of
 * the required phrases disappear from the label, a resubmission will be rejected
 * with 30475 again.
 *
 * If you NEED to change the label copy, bump `SMS_CONSENT_VERSION` in
 * `src/lib/sms-consent.ts` and coordinate a new TFV submission via
 * `scripts/resubmit-tollfree-verifications.ts` (Phase 6).
 */
describe("SMS consent label copy", () => {
  it("starts with the (Optional) prefix to signal non-mandatory consent", () => {
    expect(SMS_CONSENT_LABEL_TEXT).toMatch(/^\(Optional\)/);
  });

  it("names Uplifter AND the organizations the user joins (platform-level consent scope)", () => {
    expect(SMS_CONSENT_LABEL_TEXT).toContain("Uplifter");
    expect(SMS_CONSENT_LABEL_TEXT).toContain("organizations I join");
  });

  it("discloses the shared toll-free number routing model", () => {
    expect(SMS_CONSENT_LABEL_TEXT).toContain("shared toll-free number");
  });

  it("includes the TCPA-required rate disclosure", () => {
    expect(SMS_CONSENT_LABEL_TEXT).toContain("message & data rates may apply");
  });

  it("advertises the STOP and HELP keyword behavior", () => {
    expect(SMS_CONSENT_LABEL_TEXT).toContain("STOP");
    expect(SMS_CONSENT_LABEL_TEXT).toContain("HELP");
  });

  it("references the Terms of Service and Privacy Policy", () => {
    expect(SMS_CONSENT_LABEL_TEXT).toContain("Terms of Service");
    expect(SMS_CONSENT_LABEL_TEXT).toContain("Privacy Policy");
  });
});

describe("SMS consent legal URLs", () => {
  it("points Terms of Service at the marketing-site canonical URL", () => {
    expect(TERMS_OF_SERVICE_URL).toBe("https://www.uplifterinc.com/terms-of-service");
  });

  it("points Privacy Policy at the marketing-site canonical URL", () => {
    expect(PRIVACY_POLICY_URL).toBe("https://www.uplifterinc.com/privacy-policy");
  });
});
