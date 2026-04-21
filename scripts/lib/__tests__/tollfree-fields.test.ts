import { describe, it, expect } from "vitest";
import { buildTollFreeFields, toTwilioPayload, validateEnv } from "../tollfree-fields";

const VALID_ENV: NodeJS.ProcessEnv = {
  TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
  TWILIO_AUTH_TOKEN: "token-value",
  TWILIO_MESSAGING_SERVICE_SID: "MG00000000000000000000000000000000",
  TWILIO_CUSTOMER_PROFILE_SID: "BU00000000000000000000000000000000",
  TWILIO_TFV_BUSINESS_CONTACT_FIRST_NAME: "Authorized",
  TWILIO_TFV_BUSINESS_CONTACT_LAST_NAME: "Representative",
  TWILIO_TFV_BUSINESS_CONTACT_EMAIL: "compliance@uplifterinc.com",
  TWILIO_TFV_BUSINESS_CONTACT_PHONE: "+18005551234",
  TWILIO_TFV_NOTIFICATION_EMAIL: "compliance@uplifterinc.com",
  TWILIO_TFV_OPTIN_URL_PRIMARY: "https://upliftergymnastics.com/sms-opt-in",
};

describe("validateEnv", () => {
  it("passes with the canonical valid env", () => {
    expect(validateEnv(VALID_ENV)).toEqual([]);
  });

  it("flags every missing required var", () => {
    const errors = validateEnv({});
    const fields = new Set(errors.map((e) => e.field));
    expect(fields.has("TWILIO_ACCOUNT_SID")).toBe(true);
    expect(fields.has("TWILIO_TFV_BUSINESS_CONTACT_EMAIL")).toBe(true);
    expect(fields.has("TWILIO_TFV_OPTIN_URL_PRIMARY")).toBe(true);
  });

  it("rejects a personal @gmail.com address", () => {
    const errors = validateEnv({
      ...VALID_ENV,
      TWILIO_TFV_BUSINESS_CONTACT_EMAIL: "andrew@gmail.com",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("TWILIO_TFV_BUSINESS_CONTACT_EMAIL");
    expect(errors[0].reason).toMatch(/personal/);
  });

  it("rejects @outlook.com, @hotmail.com, @yahoo.com, @icloud.com", () => {
    for (const personal of [
      "foo@outlook.com",
      "foo@hotmail.com",
      "foo@yahoo.com",
      "foo@icloud.com",
    ]) {
      const errors = validateEnv({ ...VALID_ENV, TWILIO_TFV_BUSINESS_CONTACT_EMAIL: personal });
      expect(errors.map((e) => e.field)).toContain("TWILIO_TFV_BUSINESS_CONTACT_EMAIL");
    }
  });

  it("rejects an email that contains the contact's first name", () => {
    const errors = validateEnv({
      ...VALID_ENV,
      TWILIO_TFV_BUSINESS_CONTACT_FIRST_NAME: "Jordan",
      TWILIO_TFV_BUSINESS_CONTACT_EMAIL: "jordan.doe@uplifterinc.com",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("TWILIO_TFV_BUSINESS_CONTACT_EMAIL");
    expect(errors[0].reason).toMatch(/first\/last name/);
  });

  it("rejects an email that contains the contact's last name", () => {
    const errors = validateEnv({
      ...VALID_ENV,
      TWILIO_TFV_BUSINESS_CONTACT_LAST_NAME: "Karzel",
      TWILIO_TFV_BUSINESS_CONTACT_EMAIL: "karzel@uplifterinc.com",
    });
    expect(errors.map((e) => e.field)).toContain("TWILIO_TFV_BUSINESS_CONTACT_EMAIL");
  });

  it("rejects a non-https opt-in URL", () => {
    const errors = validateEnv({
      ...VALID_ENV,
      TWILIO_TFV_OPTIN_URL_PRIMARY: "http://upliftergymnastics.com/get-started",
    });
    expect(errors.some((e) => e.reason.includes("https"))).toBe(true);
  });

  it("rejects a localhost opt-in URL", () => {
    const errors = validateEnv({
      ...VALID_ENV,
      TWILIO_TFV_OPTIN_URL_PRIMARY: "http://localhost:3000/get-started",
    });
    const reasons = errors.map((e) => e.reason).join(" ");
    expect(reasons).toMatch(/non-public|https/);
  });

  it("rejects the dev subdomain as an opt-in URL", () => {
    const errors = validateEnv({
      ...VALID_ENV,
      TWILIO_TFV_OPTIN_URL_PRIMARY: "https://upliftergymnastics-dev.com/get-started",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/non-public/);
  });

  it("validates the optional secondary opt-in URL when provided", () => {
    const errors = validateEnv({
      ...VALID_ENV,
      TWILIO_TFV_OPTIN_URL_SECONDARY: "http://localhost:3000/sites/demo/signup",
    });
    expect(errors.map((e) => e.field)).toContain("TWILIO_TFV_OPTIN_URL_SECONDARY");
  });
});

describe("buildTollFreeFields", () => {
  it("builds a payload that passes validation", () => {
    const fields = buildTollFreeFields(VALID_ENV);
    expect(fields.BusinessName).toBe("Uplifter LLC");
    expect(fields.BusinessCountry).toBe("US");
    expect(fields.OptInType).toBe("WEB_FORM");
    expect(fields.AgeGatedContent).toBe(false);
    expect(fields.OptInImageUrls).toEqual(["https://upliftergymnastics.com/sms-opt-in"]);
  });

  it("includes the secondary opt-in URL when set", () => {
    const fields = buildTollFreeFields({
      ...VALID_ENV,
      TWILIO_TFV_OPTIN_URL_SECONDARY: "https://upliftergymnastics.com/sites/demo/signup",
    });
    expect(fields.OptInImageUrls).toHaveLength(2);
  });

  it("contains the canonical AdditionalInformation copy", () => {
    const fields = buildTollFreeFields(VALID_ENV);
    expect(fields.AdditionalInformation).toMatch(/SEPARATE, UNCHECKED/);
    expect(fields.AdditionalInformation).toMatch(/refuses to send SMS/);
    expect(fields.AdditionalInformation).toMatch(/STOP clears both/);
  });

  it("throws if env is invalid rather than returning partial data", () => {
    expect(() => buildTollFreeFields({})).toThrow(/Invalid TFV environment variables/);
  });

  it("links the Customer Profile SID", () => {
    const fields = buildTollFreeFields(VALID_ENV);
    expect(fields.CustomerProfileSid).toBe(VALID_ENV.TWILIO_CUSTOMER_PROFILE_SID);
  });
});

describe("toTwilioPayload", () => {
  it("drops undefined fields so they don't get serialized", () => {
    const fields = buildTollFreeFields(VALID_ENV);
    const payload = toTwilioPayload(fields);
    expect(payload).not.toHaveProperty("BusinessStreetAddress");
    expect(payload).not.toHaveProperty("BusinessRegistrationNumber");
    expect(payload).toHaveProperty("BusinessName");
  });

  it("preserves array fields like OptInImageUrls", () => {
    const fields = buildTollFreeFields(VALID_ENV);
    const payload = toTwilioPayload(fields);
    expect(Array.isArray(payload.OptInImageUrls)).toBe(true);
  });
});
