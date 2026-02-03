-- CreateEnum
CREATE TYPE "NotificationTriggerType" AS ENUM ('MEMBERSHIP_EXPIRY', 'MEMBERSHIP_EXPIRED', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'PAYMENT_RECEIVED', 'PROGRAM_REMINDER', 'PROGRAM_ENROLLMENT', 'PROGRAM_CANCELLATION', 'EVENT_REMINDER', 'EVENT_REGISTRATION_OPEN', 'EVENT_REGISTRATION_CLOSE', 'ATTENDANCE_MISSED', 'SKILL_ACHIEVED', 'EVALUATION_DUE', 'EVALUATION_COMPLETED', 'BIRTHDAY', 'WAITLIST_OPENING', 'CONTRACT_RENEWAL', 'MAKEUP_CLASS_EXPIRING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationActionType" AS ENUM ('ANNOUNCEMENT', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('ALL_FAMILIES', 'ALL_ATHLETES', 'PROGRAM_MEMBERS', 'MEMBERSHIP_HOLDERS', 'INTERNAL_USERS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationTimingDirection" AS ENUM ('BEFORE', 'AFTER', 'AT');

-- CreateEnum
CREATE TYPE "NotificationTimingUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "NotificationTriggerType" NOT NULL,
    "timingValue" INTEGER NOT NULL DEFAULT 0,
    "timingUnit" "NotificationTimingUnit" NOT NULL DEFAULT 'DAYS',
    "timingDirection" "NotificationTimingDirection" NOT NULL DEFAULT 'BEFORE',
    "actionType" "NotificationActionType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "notificationRuleId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "smsBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipientConfig" (
    "id" TEXT NOT NULL,
    "notificationRuleId" TEXT NOT NULL,
    "recipientType" "NotificationRecipientType" NOT NULL DEFAULT 'ALL_FAMILIES',
    "filters" JSONB,
    "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecipientConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "notificationRuleId" TEXT,
    "triggerType" "NotificationTriggerType" NOT NULL,
    "actionType" "NotificationActionType" NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientName" TEXT,
    "familyId" TEXT,
    "athleteId" TEXT,
    "userId" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "NotificationLogStatus" NOT NULL DEFAULT 'PENDING',
    "emailMessageId" TEXT,
    "smsMessageId" TEXT,
    "announcementId" TEXT,
    "errorMessage" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationRule_organizationId_idx" ON "NotificationRule"("organizationId");

-- CreateIndex
CREATE INDEX "NotificationRule_triggerType_idx" ON "NotificationRule"("triggerType");

-- CreateIndex
CREATE INDEX "NotificationRule_isSystem_idx" ON "NotificationRule"("isSystem");

-- CreateIndex
CREATE INDEX "NotificationRule_isActive_idx" ON "NotificationRule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_notificationRuleId_key" ON "NotificationTemplate"("notificationRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipientConfig_notificationRuleId_key" ON "NotificationRecipientConfig"("notificationRuleId");

-- CreateIndex
CREATE INDEX "NotificationLog_organizationId_idx" ON "NotificationLog"("organizationId");

-- CreateIndex
CREATE INDEX "NotificationLog_notificationRuleId_idx" ON "NotificationLog"("notificationRuleId");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX "NotificationLog_triggerType_idx" ON "NotificationLog"("triggerType");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_familyId_idx" ON "NotificationLog"("familyId");

-- CreateIndex
CREATE INDEX "NotificationLog_athleteId_idx" ON "NotificationLog"("athleteId");

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_notificationRuleId_fkey" FOREIGN KEY ("notificationRuleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipientConfig" ADD CONSTRAINT "NotificationRecipientConfig_notificationRuleId_fkey" FOREIGN KEY ("notificationRuleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_notificationRuleId_fkey" FOREIGN KEY ("notificationRuleId") REFERENCES "NotificationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
