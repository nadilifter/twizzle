import { describe, it, expect } from "vitest";
import {
  computeReferralLedgerMismatches,
  generateReferralCode,
  REFERRAL_CODE_PATTERN,
} from "../referral";

describe("generateReferralCode", () => {
  it("produces codes matching the documented pattern", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateReferralCode()).toMatch(REFERRAL_CODE_PATTERN);
    }
  });
});

describe("computeReferralLedgerMismatches", () => {
  it("returns no mismatches when counter matches the ledger sum", () => {
    const mismatches = computeReferralLedgerMismatches([
      {
        id: "ref-1",
        creditMonthsUsed: 2,
        applications: [{ monthsApplied: 1 }, { monthsApplied: 1 }],
      },
      { id: "ref-2", creditMonthsUsed: 0, applications: [] },
    ]);
    expect(mismatches).toEqual([]);
  });

  it("flags a referral whose counter exceeds the sum of its applications", () => {
    // Classic pre-ledger case: counter was bumped but no row was written.
    const mismatches = computeReferralLedgerMismatches([
      {
        id: "ref-pre",
        creditMonthsUsed: 1,
        applications: [],
      },
    ]);
    expect(mismatches).toEqual([{ referralId: "ref-pre", counter: 1, summed: 0 }]);
  });

  it("flags a referral whose ledger sum exceeds the counter", () => {
    // Defensive: counter was not bumped but a ledger row was inserted — the
    // guarded transaction should prevent this, but the invariant is symmetric.
    const mismatches = computeReferralLedgerMismatches([
      {
        id: "ref-bad",
        creditMonthsUsed: 1,
        applications: [{ monthsApplied: 1 }, { monthsApplied: 1 }],
      },
    ]);
    expect(mismatches).toEqual([{ referralId: "ref-bad", counter: 1, summed: 2 }]);
  });

  it("respects monthsApplied values greater than 1", () => {
    const mismatches = computeReferralLedgerMismatches([
      {
        id: "ref-multi",
        creditMonthsUsed: 4,
        applications: [{ monthsApplied: 3 }, { monthsApplied: 1 }],
      },
    ]);
    expect(mismatches).toEqual([]);
  });
});
