import { db } from "@/lib/db";
import { setSweepStatus } from "@/lib/adyen-platform";
import { logger } from "@/lib/logger";

type AccountSnapshot = {
  organizationId: string;
  balanceAccountId: string | null;
  sweepId: string | null;
  regressionAt: Date | null;
};

/**
 * Side effects to run whenever an account transitions from a non-VERIFIED state
 * back to VERIFIED — whether detected via webhook or live-sync.
 *
 * - Re-enables the Adyen sweep
 * - Republishes the marketing site if the system was the one that unpublished it
 *   (i.e. websiteConfig.updatedAt > account.regressionAt)
 */
export async function handleVerificationRecovery(account: AccountSnapshot): Promise<void> {
  const { organizationId, balanceAccountId, sweepId, regressionAt } = account;

  if (balanceAccountId && sweepId) {
    try {
      await setSweepStatus(balanceAccountId, sweepId, "active");
      logger.info("[RECOVERY] Sweep re-enabled after onboarding recovery", {
        organizationId,
        sweepId,
      });
    } catch {
      logger.error("[RECOVERY] Failed to re-enable sweep on recovery", {
        organizationId,
        sweepId,
      });
    }
  }

  if (regressionAt) {
    try {
      const websiteConfig = await db.websiteConfig.findUnique({
        where: { organizationId },
        select: { isPublished: true, updatedAt: true },
      });

      const systemCausedUnpublish =
        websiteConfig && !websiteConfig.isPublished && websiteConfig.updatedAt > regressionAt;

      if (systemCausedUnpublish) {
        await db.websiteConfig.update({
          where: { organizationId },
          data: { isPublished: true },
        });
        logger.info("[RECOVERY] Website republished after onboarding recovery", {
          organizationId,
        });
      }
    } catch {
      logger.error("[RECOVERY] Failed to republish website on recovery", {
        organizationId,
      });
    }
  }
}
