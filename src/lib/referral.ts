import crypto from "crypto";

const REFERRAL_CODE_BYTES = 4;

export const REFERRAL_CODE_PATTERN = /^[A-F0-9]{8}$/;

export function generateReferralCode(): string {
  return crypto.randomBytes(REFERRAL_CODE_BYTES).toString("hex").toUpperCase();
}

export type ReferralIntegrityMismatch = {
  referralId: string;
  counter: number;
  summed: number;
};

// Invariant: for every Referral, SUM(applications.monthsApplied) must equal
// creditMonthsUsed. Any mismatch means either a pre-ledger application or a
// bug in the billing transaction. Used by the superadmin referrals page to
// surface issues inline and by tests to guard the invariant.
export function computeReferralLedgerMismatches(
  referrals: Array<{
    id: string;
    creditMonthsUsed: number;
    applications: Array<{ monthsApplied: number }>;
  }>
): ReferralIntegrityMismatch[] {
  return referrals
    .map((r) => {
      const summed = r.applications.reduce((sum, a) => sum + a.monthsApplied, 0);
      return { referralId: r.id, counter: r.creditMonthsUsed, summed };
    })
    .filter((r) => r.counter !== r.summed);
}
