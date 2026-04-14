-- AlterTable
ALTER TABLE "OrganizationSubscription" ADD COLUMN     "nextBillingDate" TIMESTAMP(3);

-- Backfill: set nextBillingDate to 15 days from now for all non-cancelled/paused subs.
-- No real customers exist yet so a flat date is sufficient.
UPDATE "OrganizationSubscription"
SET "nextBillingDate" = NOW() + INTERVAL '15 days'
WHERE status NOT IN ('CANCELLED', 'PAUSED');
