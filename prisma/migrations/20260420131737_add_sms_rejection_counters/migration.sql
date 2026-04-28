-- AlterTable
ALTER TABLE "SmsUsage" ADD COLUMN     "rejectedNoConsent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectedOptOut" INTEGER NOT NULL DEFAULT 0;
