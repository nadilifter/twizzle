-- AlterTable
ALTER TABLE "AdyenPlatformAccount" ADD COLUMN     "legalNameConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "platformAgreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "platformFeeAcknowledgedAt" TIMESTAMP(3);
