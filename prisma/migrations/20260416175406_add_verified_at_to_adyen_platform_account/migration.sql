-- AlterTable
ALTER TABLE "AdyenPlatformAccount"
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "regressionAt" TIMESTAMP(3),
  ADD COLUMN "regressionErrors" JSONB;
