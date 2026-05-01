-- CreateEnum
CREATE TYPE "ReconciledVia" AS ENUM ('REFERENCE_MATCH', 'TIME_WINDOW');

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN "reconciledVia" "ReconciledVia";
