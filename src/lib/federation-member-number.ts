// Federation-aware format validation for federationMemberNumber.
//
// This is the local-only validator from Phase 1.1 of the roadmap. It only
// checks shape — not whether the number actually exists in the federation's
// CRM. Phase 6.2 replaces this with a live Skate Canada API lookup; the
// shape check stays as a pre-flight to avoid round-trips for obviously
// malformed input.

const FEDERATION_NUMBER_FORMATS: Record<string, RegExp> = {
  // Skate Canada CRM numbers look like SC-12345678 (6-10 digits after the
  // prefix). Case-sensitive — the prefix is canonical.
  SKATE_CANADA: /^SC-\d{6,10}$/,
  // U.S. Figure Skating numbers look like USFS-123456 (4-10 digits).
  USFS: /^USFS-\d{4,10}$/,
  // ISU numbers are alphanumeric, length varies; accept a permissive shape
  // until we have stricter format requirements.
  ISU: /^[A-Z0-9-]{4,32}$/,
};

const FEDERATION_HINTS: Record<string, string> = {
  SKATE_CANADA: "Skate Canada numbers look like SC-12345678",
  USFS: "USFS numbers look like USFS-123456",
  ISU: "ISU numbers are uppercase letters, digits, and hyphens (4-32 chars)",
};

export function validateFederationMemberNumber(
  federation: string | null | undefined,
  memberNumber: string | null | undefined
): string | null {
  const trimmed = memberNumber?.trim() ?? "";
  if (!trimmed) return null;
  if (!federation) return "Select a federation before entering a member number";
  const pattern = FEDERATION_NUMBER_FORMATS[federation];
  if (!pattern) return null;
  if (!pattern.test(trimmed)) {
    return FEDERATION_HINTS[federation] ?? `Invalid member number format for ${federation}`;
  }
  return null;
}

// Phase 1.2 enrollment-time gate. Returns the human-readable reason the
// enrollment should be blocked, or null if the athlete's federation
// membership is good for the given effective date.
//
// `effectiveDate` is the enrollment's startDate — the athlete must hold a
// valid membership at the moment they begin the program. Mid-program expiry
// is a separate concern handled by ongoing-renewal monitoring (not here).
//
// If `memberExpiresAt` is null but a number is set, we fail open — the
// federation may issue lifetime memberships, and the per-org admin can
// always renew the date manually if a strict check is needed.
export function getFederationMembershipBlockReason(args: {
  federationMemberNumber: string | null | undefined;
  federationMemberExpiresAt: Date | null | undefined;
  effectiveDate: Date;
}): string | null {
  const memberNumber = args.federationMemberNumber?.trim() ?? "";
  if (!memberNumber) {
    return "Athlete needs a valid federation membership before enrolling in this program";
  }
  if (args.federationMemberExpiresAt && args.federationMemberExpiresAt < args.effectiveDate) {
    const expDate = args.federationMemberExpiresAt.toISOString().split("T")[0];
    return `Federation membership expired on ${expDate} — renew before enrolling`;
  }
  return null;
}
