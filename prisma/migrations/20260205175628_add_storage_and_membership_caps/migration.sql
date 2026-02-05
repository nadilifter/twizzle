-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "fileSize" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "maxMembershipTypes" INTEGER,
ADD COLUMN     "maxStorageMB" INTEGER;
