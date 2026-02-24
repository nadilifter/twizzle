-- DropForeignKey
ALTER TABLE "FamilyContact" DROP CONSTRAINT IF EXISTS "FamilyContact_familyId_fkey";
ALTER TABLE "FamilyBillingAddress" DROP CONSTRAINT IF EXISTS "FamilyBillingAddress_familyId_fkey";
ALTER TABLE "AthleteGuardian" DROP CONSTRAINT IF EXISTS "AthleteGuardian_familyId_fkey";
ALTER TABLE "PaymentMethod" DROP CONSTRAINT IF EXISTS "PaymentMethod_familyId_fkey";
ALTER TABLE "InstanceRegistration" DROP CONSTRAINT IF EXISTS "InstanceRegistration_familyId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_familyId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_familyId_fkey";
ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_familyId_fkey";
ALTER TABLE "RecurringCharge" DROP CONSTRAINT IF EXISTS "RecurringCharge_familyId_fkey";
ALTER TABLE "SmsMessage" DROP CONSTRAINT IF EXISTS "SmsMessage_familyId_fkey";
ALTER TABLE "SmsConversation" DROP CONSTRAINT IF EXISTS "SmsConversation_familyId_fkey";
ALTER TABLE "EmailMessage" DROP CONSTRAINT IF EXISTS "EmailMessage_familyId_fkey";
ALTER TABLE "WaiverSignature" DROP CONSTRAINT IF EXISTS "WaiverSignature_familyId_fkey";
ALTER TABLE "WaiverAcceptance" DROP CONSTRAINT IF EXISTS "WaiverAcceptance_familyId_fkey";
ALTER TABLE "NotificationLog" DROP CONSTRAINT IF EXISTS "NotificationLog_familyId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "AthleteGuardian_athleteId_familyId_key";
DROP INDEX IF EXISTS "SmsConversation_organizationId_familyId_key";
DROP INDEX IF EXISTS "WaiverSignature_waiverPageId_familyId_athleteId_key";
DROP INDEX IF EXISTS "WaiverSignature_familyId_idx";
DROP INDEX IF EXISTS "WaiverAcceptance_waiverId_familyId_athleteId_key";
DROP INDEX IF EXISTS "WaiverAcceptance_familyId_idx";
DROP INDEX IF EXISTS "NotificationDeduplication_ruleId_entityType_entityId_familyId_key";
DROP INDEX IF EXISTS "Invoice_familyId_idx";
DROP INDEX IF EXISTS "RecurringCharge_familyId_idx";
DROP INDEX IF EXISTS "SmsMessage_familyId_idx";
DROP INDEX IF EXISTS "EmailMessage_familyId_idx";
DROP INDEX IF EXISTS "NotificationLog_familyId_idx";
DROP INDEX IF EXISTS "InstanceRegistration_familyId_idx";

-- AlterTable: Drop familyId columns
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "AthleteGuardian" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "PaymentMethod" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "InstanceRegistration" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "Enrollment" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "RecurringCharge" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "SmsMessage" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "SmsConversation" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "EmailMessage" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "WaiverSignature" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "WaiverAcceptance" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "NotificationRule" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "NotificationDeduplication" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "NotificationLog" DROP COLUMN IF EXISTS "familyId";
ALTER TABLE "QueueEntry" DROP COLUMN IF EXISTS "familyId";

-- Drop targetFamilyIds
ALTER TABLE "EmailCampaign" DROP COLUMN IF EXISTS "targetFamilyIds";
ALTER TABLE "SmsCampaign" DROP COLUMN IF EXISTS "targetFamilyIds";

-- CreateIndex: New unique constraints to replace family-based ones
CREATE UNIQUE INDEX IF NOT EXISTS "SmsConversation_organizationId_userId_key" ON "SmsConversation"("organizationId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "WaiverSignature_waiverPageId_userId_athleteId_key" ON "WaiverSignature"("waiverPageId", "userId", "athleteId");
CREATE UNIQUE INDEX IF NOT EXISTS "WaiverAcceptance_waiverId_userId_athleteId_key" ON "WaiverAcceptance"("waiverId", "userId", "athleteId");

-- DropTable
DROP TABLE IF EXISTS "FamilyContact";
DROP TABLE IF EXISTS "FamilyBillingAddress";
DROP TABLE IF EXISTS "Family";

-- Rename FAMILY enum values to GUARDIAN
ALTER TYPE "AnnouncementScope" RENAME VALUE 'FAMILY' TO 'GUARDIAN';
ALTER TYPE "SmsTargetType" RENAME VALUE 'ALL_FAMILIES' TO 'ALL_GUARDIANS';
ALTER TYPE "EmailTargetType" RENAME VALUE 'ALL_FAMILIES' TO 'ALL_GUARDIANS';
ALTER TYPE "NotificationRecipientType" RENAME VALUE 'ALL_FAMILIES' TO 'ALL_GUARDIANS';
