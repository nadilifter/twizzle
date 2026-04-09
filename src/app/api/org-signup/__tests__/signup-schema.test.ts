import { describe, it, expect } from "vitest";
import { signupSchema } from "../signup-schema";

const base = {
  name: "Test User",
  email: "test@example.com",
  password: "TestPassword1!",
  orgName: "Test Org",
  orgEmail: "org@example.com",
  phone: "+12025550123",
  street: "123 Main St",
  city: "Boston",
  stateProvince: "MA",
  postalCode: "02101",
  country: "US" as const,
  subdomain: "testorg",
  planId: "plan-1",
};

describe("signupSchema adyenShopperReference", () => {
  it("accepts signup- prefix from payment-session", () => {
    const parsed = signupSchema.parse({
      ...base,
      adyenShopperReference: "signup-testorg-1234567890",
    });
    expect(parsed.adyenShopperReference).toBe("signup-testorg-1234567890");
  });

  it("rejects org- prefix", () => {
    expect(() =>
      signupSchema.parse({
        ...base,
        adyenShopperReference: "org-uuid-here",
      })
    ).toThrow();
  });

  it("rejects too-short shopper reference", () => {
    expect(() =>
      signupSchema.parse({
        ...base,
        adyenShopperReference: "ab",
      })
    ).toThrow();
  });
});
