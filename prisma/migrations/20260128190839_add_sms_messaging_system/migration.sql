-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "SmsClassification" AS ENUM ('GENERAL', 'REMINDER', 'ALERT', 'BILLING', 'EVENT', 'NEWS');

-- CreateEnum
CREATE TYPE "SmsCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "smsOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptOutAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "smsIncluded" INTEGER,
ADD COLUMN     "smsOverageRate" DECIMAL(10,4);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "familyId" TEXT,
    "staffProfileId" TEXT,
    "campaignId" TEXT,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segments" INTEGER NOT NULL DEFAULT 1,
    "twilioSid" TEXT,
    "twilioStatus" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "direction" "SmsDirection" NOT NULL DEFAULT 'OUTBOUND',
    "classification" "SmsClassification" NOT NULL DEFAULT 'GENERAL',
    "cost" DECIMAL(10,4),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "classification" "SmsClassification" NOT NULL DEFAULT 'GENERAL',
    "targetScope" "AnnouncementScope" NOT NULL DEFAULT 'ALL',
    "targetProgramId" TEXT,
    "targetEventId" TEXT,
    "status" "SmsCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesDelivered" INTEGER NOT NULL DEFAULT 0,
    "messagesFailed" INTEGER NOT NULL DEFAULT 0,
    "totalSegments" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "includedMessages" INTEGER NOT NULL DEFAULT 0,
    "overageMessages" INTEGER NOT NULL DEFAULT 0,
    "overageCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsMessage_twilioSid_key" ON "SmsMessage"("twilioSid");

-- CreateIndex
CREATE INDEX "SmsMessage_organizationId_idx" ON "SmsMessage"("organizationId");

-- CreateIndex
CREATE INDEX "SmsMessage_familyId_idx" ON "SmsMessage"("familyId");

-- CreateIndex
CREATE INDEX "SmsMessage_campaignId_idx" ON "SmsMessage"("campaignId");

-- CreateIndex
CREATE INDEX "SmsMessage_twilioSid_idx" ON "SmsMessage"("twilioSid");

-- CreateIndex
CREATE INDEX "SmsMessage_twilioStatus_idx" ON "SmsMessage"("twilioStatus");

-- CreateIndex
CREATE INDEX "SmsMessage_createdAt_idx" ON "SmsMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SmsCampaign_organizationId_idx" ON "SmsCampaign"("organizationId");

-- CreateIndex
CREATE INDEX "SmsCampaign_status_idx" ON "SmsCampaign"("status");

-- CreateIndex
CREATE INDEX "SmsCampaign_createdAt_idx" ON "SmsCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "SmsUsage_organizationId_idx" ON "SmsUsage"("organizationId");

-- CreateIndex
CREATE INDEX "SmsUsage_periodStart_idx" ON "SmsUsage"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "SmsUsage_organizationId_periodStart_key" ON "SmsUsage"("organizationId", "periodStart");

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsUsage" ADD CONSTRAINT "SmsUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
