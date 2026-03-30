import { AdyenOnboardingStatus } from "@prisma/client";

/**
 * Derive the onboarding status from an Adyen account holder's capabilities.
 * Used by both the balance-platform webhook and the live-sync GET endpoint.
 */
export function deriveOnboardingStatus(accountHolder: any): AdyenOnboardingStatus {
  const capabilities = accountHolder.capabilities || {};
  const capEntries = Object.values(capabilities) as any[];

  if (capEntries.length === 0) {
    return AdyenOnboardingStatus.PENDING_HOSTED;
  }

  const allAllowed = capEntries.every((c: any) => c.allowed === true);
  if (allAllowed) {
    return AdyenOnboardingStatus.VERIFIED;
  }

  const hasProblems = capEntries.some((c: any) => c.problems && c.problems.length > 0);

  if (hasProblems) {
    const allProblems = capEntries.flatMap((c: any) => c.problems || []);
    const hasDataMissing = allProblems.some(
      (p: any) =>
        p.entity?.type === "LegalEntity" &&
        p.verificationErrors?.some((e: any) => e.type === "dataMissing")
    );
    const hasRejected = allProblems.some((p: any) =>
      p.verificationErrors?.some((e: any) => e.type === "rejected")
    );

    if (hasRejected) {
      return AdyenOnboardingStatus.REJECTED;
    }
    if (hasDataMissing) {
      return AdyenOnboardingStatus.AWAITING_DATA;
    }
  }

  const anyPending = capEntries.some((c: any) => c.verificationStatus === "pending");
  if (anyPending) {
    return AdyenOnboardingStatus.IN_REVIEW;
  }

  return AdyenOnboardingStatus.IN_PROGRESS;
}

/**
 * Produce a human-readable summary of an account holder's verification state.
 */
export function summarizeVerification(accountHolder: any): string {
  const capabilities = accountHolder.capabilities || {};
  const entries = Object.entries(capabilities) as [string, any][];

  if (entries.length === 0) return "No capabilities";

  const allowed = entries.filter(([, c]) => c.allowed === true).length;
  const pending = entries.filter(([, c]) => c.verificationStatus === "pending").length;
  const total = entries.length;

  if (allowed === total) return "All capabilities verified";
  if (pending > 0) return `${pending}/${total} capabilities pending verification`;

  const problems = entries.flatMap(([, c]) => c.problems || []);
  const errorCount = problems.reduce(
    (sum: number, p: any) => sum + (p.verificationErrors?.length || 0),
    0
  );
  if (errorCount > 0) return `${errorCount} verification error(s) to resolve`;

  return `${allowed}/${total} capabilities allowed`;
}
