import { describe, it, expect, vi } from "vitest";
import { db } from "@/lib/db";

describe("test infrastructure", () => {
  it("resolves the mocked Prisma client", () => {
    expect(db).toBeDefined();
    expect(db.organization).toBeDefined();
    expect(db.organization.findMany).toBeDefined();
  });

  it("mock resets between tests", () => {
    vi.mocked(db.organization.findMany).mockResolvedValueOnce([]);
    expect(db.organization.findMany).toHaveBeenCalledTimes(0);
  });
});
