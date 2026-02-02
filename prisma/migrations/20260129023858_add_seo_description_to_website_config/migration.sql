/*
  Warnings:

  - You are about to drop the column `conversationId` on the `SmsMessage` table. All the data in the column will be lost.
  - You are about to drop the column `smsOptOut` on the `StaffProfile` table. All the data in the column will be lost.
  - You are about to drop the column `smsOptOutAt` on the `StaffProfile` table. All the data in the column will be lost.
  - You are about to drop the `SmsConversation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SmsConversation" DROP CONSTRAINT "SmsConversation_familyId_fkey";

-- DropForeignKey
ALTER TABLE "SmsConversation" DROP CONSTRAINT "SmsConversation_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "SmsConversation" DROP CONSTRAINT "SmsConversation_staffProfileId_fkey";

-- DropForeignKey
ALTER TABLE "SmsMessage" DROP CONSTRAINT "SmsMessage_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "SmsMessage" DROP CONSTRAINT "SmsMessage_staffProfileId_fkey";

-- DropIndex
DROP INDEX "SmsMessage_conversationId_idx";

-- DropIndex
DROP INDEX "SmsMessage_staffProfileId_idx";

-- AlterTable
ALTER TABLE "SmsMessage" DROP COLUMN "conversationId";

-- AlterTable
ALTER TABLE "StaffProfile" DROP COLUMN "smsOptOut",
DROP COLUMN "smsOptOutAt";

-- AlterTable
ALTER TABLE "WebsiteConfig" ADD COLUMN     "googleVerification" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoKeywords" TEXT;

-- DropTable
DROP TABLE "SmsConversation";
