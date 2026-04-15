-- CreateEnum
CREATE TYPE "AdyenAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "AdyenPlatformAccount" ADD COLUMN     "accountStatus" "AdyenAccountStatus" NOT NULL DEFAULT 'ACTIVE';
