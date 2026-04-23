import { describe, it, expect } from "vitest";
import { formatPrice } from "../format-utils";

describe("formatPrice", () => {
  it("returns 'Free' for null or undefined", () => {
    expect(formatPrice(null)).toBe("Free");
    expect(formatPrice(undefined)).toBe("Free");
  });

  it("returns 'Free' for zero", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice("0")).toBe("Free");
    expect(formatPrice("0.00")).toBe("Free");
  });

  it("returns 'Free' for non-finite strings", () => {
    expect(formatPrice("not a number")).toBe("Free");
  });

  it("formats whole-number prices with no decimals", () => {
    expect(formatPrice(25)).toBe("$25");
    expect(formatPrice("25")).toBe("$25");
  });

  it("formats prices with cents", () => {
    expect(formatPrice(19.99)).toBe("$19.99");
    expect(formatPrice("19.99")).toBe("$19.99");
  });

  it("rounds above the max-two-decimal precision", () => {
    expect(formatPrice(9.999)).toBe("$10");
  });
});
