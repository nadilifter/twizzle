-- Backfill verifiedAt for accounts that are already VERIFIED but were created
-- before the verifiedAt field was introduced. Use updatedAt as a proxy since
-- that timestamp reflects the last webhook that set the VERIFIED status.
UPDATE "AdyenPlatformAccount"
SET "verifiedAt" = "updatedAt"
WHERE "onboardingStatus" = 'VERIFIED'
  AND "verifiedAt" IS NULL;
