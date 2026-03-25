-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "scheduledDeactivationDate" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "dunningWarningsSent" JSONB;
