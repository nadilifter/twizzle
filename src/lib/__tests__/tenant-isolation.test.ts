import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("TenantIsolationError", () => {
  it("has correct name and default message", async () => {
    const { TenantIsolationError } = await import("../db" as string);
    const err = new TenantIsolationError();
    expect(err.name).toBe("TenantIsolationError");
    expect(err.message).toBe("Access denied: Resource does not belong to your organization");
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts a custom message", async () => {
    const { TenantIsolationError } = await import("../db" as string);
    const err = new TenantIsolationError("Custom denial message");
    expect(err.message).toBe("Custom denial message");
  });
});

describe("getScopedDb", () => {
  it("throws when called with empty organizationId", async () => {
    const { getScopedDb } = await import("../db" as string);
    expect(() => getScopedDb("")).toThrow("getScopedDb requires a valid organizationId");
  });
});
