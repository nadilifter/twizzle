import crypto from "crypto";

const REFERRAL_CODE_BYTES = 4;

export const REFERRAL_CODE_PATTERN = /^[A-F0-9]{8}$/;

export function generateReferralCode(): string {
  return crypto.randomBytes(REFERRAL_CODE_BYTES).toString("hex").toUpperCase();
}
