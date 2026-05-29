import { describe, it, expect } from "vitest";
import { validateFederationMemberNumber } from "../federation-member-number";

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
