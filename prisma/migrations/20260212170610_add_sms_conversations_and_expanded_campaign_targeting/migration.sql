-- CreateEnum
CREATE TYPE "SmsTargetType" AS ENUM ('ALL_USERS', 'ALL_MEMBERS', 'ALL_PROGRAM_REGISTRANTS', 'PROGRAM_ANY_INSTANCE', 'PROGRAM_SPECIFIC_INSTANCE', 'MEMBERSHIP_HOLDERS', 'SPECIFIC_USERS', 'ALL_FAMILIES');

-- CreateEnum
CREATE TYPE "SmsConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailTargetType" AS ENUM ('ALL_USERS', 'ALL_MEMBERS', 'ALL_PROGRAM_REGISTRANTS', 'PROGRAM_ANY_INSTANCE', 'PROGRAM_SPECIFIC_INSTANCE', 'MEMBERSHIP_HOLDERS', 'SPECIFIC_USERS', 'ALL_FAMILIES');

-- AlterTable
ALTER TABLE "EmailCampaign" ADD COLUMN     "targetFamilyIds" TEXT[],
ADD COLUMN     "targetMembershipGroupIds" TEXT[],
ADD COLUMN     "targetProgramInstanceId" TEXT,
ADD COLUMN     "targetType" "EmailTargetType" NOT NULL DEFAULT 'ALL_MEMBERS';

-- AlterTable
ALTER TABLE "SmsCampaign" ADD COLUMN     "targetFamilyIds" TEXT[],
ADD COLUMN     "targetMembershipGroupIds" TEXT[],
ADD COLUMN     "targetMembershipStatus" TEXT,
ADD COLUMN     "targetProgramInstanceId" TEXT,
ADD COLUMN     "targetType" "SmsTargetType" NOT NULL DEFAULT 'ALL_MEMBERS';

-- AlterTable
ALTER TABLE "SmsMessage" ADD COLUMN     "conversationId" TEXT;

-- CreateTable
CREATE TABLE "SmsConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "SmsConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3),
    "lastMessageBody" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsConversation_organizationId_lastMessageAt_idx" ON "SmsConversation"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SmsConversation_organizationId_status_idx" ON "SmsConversation"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SmsConversation_organizationId_familyId_key" ON "SmsConversation"("organizationId", "familyId");

-- CreateIndex
CREATE INDEX "SmsMessage_conversationId_createdAt_idx" ON "SmsMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SmsConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
