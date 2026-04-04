import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";

describe("test infrastructure", () => {
  it("resolves the mocked Prisma client", () => {
    expect(db).toBeDefined();
    expect(db.organization).toBeDefined();
    expect(db.organization.findMany).toBeDefined();
  });

  it("mock resets between tests", () => {
    db.organization.findMany.mockResolvedValueOnce([]);
    expect(db.organization.findMany).toHaveBeenCalledTimes(0);
  });
});
