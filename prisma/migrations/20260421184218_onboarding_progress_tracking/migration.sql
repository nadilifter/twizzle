-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "onboardingAgreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN "onboardingFeeAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN "onboardingLegalNameConfirmedAt" TIMESTAMP(3);
