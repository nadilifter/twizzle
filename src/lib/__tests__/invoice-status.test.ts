import { describe, it, expect } from "vitest";
import { INVOICE_STATUS_STYLES } from "../invoice-status";

describe("INVOICE_STATUS_STYLES", () => {
  // InvoiceStatus enum values from Prisma schema. Keep this list in sync if the
  // enum changes — the test fails fast if a new status is added without a style.
  const EXPECTED_STATUSES = ["PAID", "SENT", "OVERDUE", "DRAFT", "CANCELLED", "PARTIAL"];

  it("has a style for every InvoiceStatus enum value", () => {
    for (const status of EXPECTED_STATUSES) {
      expect(INVOICE_STATUS_STYLES[status]).toBeDefined();
      expect(INVOICE_STATUS_STYLES[status]).not.toBe("");
    }
  });

  it("returns a falsy (undefined) value for unknown statuses", () => {
    expect(INVOICE_STATUS_STYLES["UNKNOWN_STATUS"]).toBeUndefined();
  });

  it("includes expected Tailwind utility classes", () => {
    expect(INVOICE_STATUS_STYLES.PAID).toContain("green");
    expect(INVOICE_STATUS_STYLES.OVERDUE).toContain("red");
    expect(INVOICE_STATUS_STYLES.SENT).toContain("blue");
  });
});
