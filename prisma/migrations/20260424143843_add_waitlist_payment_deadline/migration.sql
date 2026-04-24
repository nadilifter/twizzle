-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationTriggerType" ADD VALUE 'WAITLIST_PAYMENT_FAILED';
ALTER TYPE "NotificationTriggerType" ADD VALUE 'WAITLIST_PAYMENT_EXPIRED';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "waitlistChargeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waitlistPaymentDeadline" TIMESTAMP(3);
