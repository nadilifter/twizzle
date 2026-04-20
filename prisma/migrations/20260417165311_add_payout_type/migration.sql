-- CreateEnum
CREATE TYPE "PayoutType" AS ENUM ('MANUAL', 'SWEEP');

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN "payoutType" "PayoutType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "AdyenPlatformAccount" ADD COLUMN "lastPayoutSyncAt" TIMESTAMP(3);
