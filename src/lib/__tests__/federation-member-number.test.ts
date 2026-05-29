import { describe, it, expect } from "vitest";
import {
  getFederationMembershipBlockReason,
  validateFederationMemberNumber,
} from "../federation-member-number";

describe("validateFederationMemberNumber", () => {
  it("accepts an empty / null number regardless of federation (field is optional)", () => {
    expect(validateFederationMemberNumber("SKATE_CANADA", null)).toBeNull();
    expect(validateFederationMemberNumber("SKATE_CANADA", "")).toBeNull();
    expect(validateFederationMemberNumber("SKATE_CANADA", "   ")).toBeNull();
    expect(validateFederationMemberNumber(null, null)).toBeNull();
  });

  it("requires a federation to be set when a number is provided", () => {
    expect(validateFederationMemberNumber(null, "SC-12345678")).toMatch(/federation/i);
    expect(validateFederationMemberNumber("", "SC-12345678")).toMatch(/federation/i);
  });

  it("accepts a well-formed Skate Canada number", () => {
    expect(validateFederationMemberNumber("SKATE_CANADA", "SC-12345678")).toBeNull();
    expect(validateFederationMemberNumber("SKATE_CANADA", "SC-123456")).toBeNull();
    expect(validateFederationMemberNumber("SKATE_CANADA", "SC-1234567890")).toBeNull();
  });

  it("rejects a malformed Skate Canada number", () => {
    expect(validateFederationMemberNumber("SKATE_CANADA", "12345678")).not.toBeNull();
    expect(validateFederationMemberNumber("SKATE_CANADA", "sc-12345678")).not.toBeNull();
    expect(validateFederationMemberNumber("SKATE_CANADA", "SC-123")).not.toBeNull();
    expect(validateFederationMemberNumber("SKATE_CANADA", "SC-ABCDEFGH")).not.toBeNull();
  });

  it("accepts a well-formed USFS number", () => {
    expect(validateFederationMemberNumber("USFS", "USFS-123456")).toBeNull();
    expect(validateFederationMemberNumber("USFS", "USFS-1234")).toBeNull();
  });

  it("rejects a malformed USFS number", () => {
    expect(validateFederationMemberNumber("USFS", "USFS-123")).not.toBeNull();
    expect(validateFederationMemberNumber("USFS", "123456")).not.toBeNull();
  });

  it("accepts permissive ISU numbers (alphanumeric + hyphen, 4-32 chars)", () => {
    expect(validateFederationMemberNumber("ISU", "ABC-1234")).toBeNull();
    expect(validateFederationMemberNumber("ISU", "12345678")).toBeNull();
  });

  it("rejects ISU numbers below the length floor", () => {
    expect(validateFederationMemberNumber("ISU", "AB")).not.toBeNull();
  });

  it("accepts unknown federations without checking format (forward-compat)", () => {
    expect(validateFederationMemberNumber("FUTURE_FED", "anything-goes-here")).toBeNull();
  });

  it("trims whitespace before validating", () => {
    expect(validateFederationMemberNumber("SKATE_CANADA", "  SC-12345678  ")).toBeNull();
  });
});

describe("getFederationMembershipBlockReason", () => {
  const futureDate = new Date("2027-06-01");
  const pastDate = new Date("2025-01-01");
  const enrollmentDate = new Date("2026-09-01");

  it("blocks when the member number is missing", () => {
    expect(
      getFederationMembershipBlockReason({
        federationMemberNumber: null,
        federationMemberExpiresAt: futureDate,
        effectiveDate: enrollmentDate,
      })
    ).toMatch(/valid federation membership/i);
  });

  it("blocks when the member number is empty/whitespace", () => {
    expect(
      getFederationMembershipBlockReason({
        federationMemberNumber: "   ",
        federationMemberExpiresAt: futureDate,
        effectiveDate: enrollmentDate,
      })
    ).toMatch(/valid federation membership/i);
  });

  it("blocks when the membership expired before the enrollment start", () => {
    const reason = getFederationMembershipBlockReason({
      federationMemberNumber: "SC-12345678",
      federationMemberExpiresAt: pastDate,
      effectiveDate: enrollmentDate,
    });
    expect(reason).toMatch(/expired/i);
    expect(reason).toContain("2025-01-01");
  });

  it("allows when the membership is valid through the enrollment start date", () => {
    expect(
      getFederationMembershipBlockReason({
        federationMemberNumber: "SC-12345678",
        federationMemberExpiresAt: futureDate,
        effectiveDate: enrollmentDate,
      })
    ).toBeNull();
  });

  it("allows when expiry exactly equals the enrollment date (boundary)", () => {
    expect(
      getFederationMembershipBlockReason({
        federationMemberNumber: "SC-12345678",
        federationMemberExpiresAt: enrollmentDate,
        effectiveDate: enrollmentDate,
      })
    ).toBeNull();
  });

  it("fails open when the expiry is null but the number is set", () => {
    expect(
      getFederationMembershipBlockReason({
        federationMemberNumber: "SC-12345678",
        federationMemberExpiresAt: null,
        effectiveDate: enrollmentDate,
      })
    ).toBeNull();
  });
});
