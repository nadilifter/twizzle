-- Guardian/Ward System Migration
-- Adds User-based guardian relationships alongside existing Family model (parallel migration)

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable: User - add phone, sms/email preferences
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "smsOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "smsOptOutAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "emailOptOutAt" TIMESTAMP(3);

-- AlterTable: Athlete - add self-athlete link and guardian claims config
ALTER TABLE "Athlete" ADD COLUMN "userId" TEXT;
ALTER TABLE "Athlete" ADD COLUMN "allowGuardianClaims" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: AthleteGuardian - make familyId nullable, add userId and visibility config
ALTER TABLE "AthleteGuardian" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "AthleteGuardian" ADD COLUMN "userId" TEXT;
ALTER TABLE "AthleteGuardian" ADD COLUMN "shareRegistrations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AthleteGuardian" ADD COLUMN "shareFinancials" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: PaymentMethod - make familyId nullable, add userId
ALTER TABLE "PaymentMethod" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "PaymentMethod" ADD COLUMN "userId" TEXT;

-- AlterTable: Invoice - make familyId nullable, add userId
ALTER TABLE "Invoice" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "userId" TEXT;

-- AlterTable: Payment - make familyId nullable, add userId
ALTER TABLE "Payment" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "userId" TEXT;

-- AlterTable: Enrollment - add userId
ALTER TABLE "Enrollment" ADD COLUMN "userId" TEXT;

-- AlterTable: InstanceRegistration - add userId
ALTER TABLE "InstanceRegistration" ADD COLUMN "userId" TEXT;

-- AlterTable: RecurringCharge - make familyId nullable, add userId
ALTER TABLE "RecurringCharge" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "RecurringCharge" ADD COLUMN "userId" TEXT;

-- AlterTable: SmsMessage - add userId
ALTER TABLE "SmsMessage" ADD COLUMN "userId" TEXT;

-- AlterTable: SmsConversation - make familyId nullable, add userId
ALTER TABLE "SmsConversation" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "SmsConversation" ADD COLUMN "userId" TEXT;

-- AlterTable: SmsCampaign - add targetUserIds
ALTER TABLE "SmsCampaign" ADD COLUMN "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: EmailMessage - add userId
ALTER TABLE "EmailMessage" ADD COLUMN "userId" TEXT;

-- AlterTable: EmailCampaign - add targetUserIds
ALTER TABLE "EmailCampaign" ADD COLUMN "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: WaiverSignature - make familyId nullable, add userId
ALTER TABLE "WaiverSignature" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "WaiverSignature" ADD COLUMN "userId" TEXT;

-- AlterTable: WaiverAcceptance - make familyId nullable, add userId
ALTER TABLE "WaiverAcceptance" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "WaiverAcceptance" ADD COLUMN "userId" TEXT;

-- AlterTable: NotificationDeduplication - make familyId nullable, add userId
ALTER TABLE "NotificationDeduplication" ALTER COLUMN "familyId" DROP NOT NULL;
ALTER TABLE "NotificationDeduplication" ADD COLUMN "userId" TEXT;

-- CreateTable: GuardianClaimRequest
CREATE TABLE "GuardianClaimRequest" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "relationship" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianClaimRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserContact
CREATE TABLE "UserContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserBillingAddress
CREATE TABLE "UserBillingAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateProvince" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBillingAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Athlete.userId unique
CREATE UNIQUE INDEX "Athlete_userId_key" ON "Athlete"("userId");

-- CreateIndex: AthleteGuardian unique on [athleteId, userId]
CREATE UNIQUE INDEX "AthleteGuardian_athleteId_userId_key" ON "AthleteGuardian"("athleteId", "userId");

-- CreateIndex: GuardianClaimRequest
CREATE UNIQUE INDEX "GuardianClaimRequest_athleteId_requestingUserId_key" ON "GuardianClaimRequest"("athleteId", "requestingUserId");
CREATE INDEX "GuardianClaimRequest_athleteId_idx" ON "GuardianClaimRequest"("athleteId");
CREATE INDEX "GuardianClaimRequest_requestingUserId_idx" ON "GuardianClaimRequest"("requestingUserId");
CREATE INDEX "GuardianClaimRequest_status_idx" ON "GuardianClaimRequest"("status");

-- CreateIndex: UserContact
CREATE INDEX "UserContact_userId_idx" ON "UserContact"("userId");

-- CreateIndex: UserBillingAddress
CREATE INDEX "UserBillingAddress_userId_idx" ON "UserBillingAddress"("userId");

-- CreateIndex: SmsConversation unique on [organizationId, userId]
CREATE UNIQUE INDEX "SmsConversation_organizationId_userId_key" ON "SmsConversation"("organizationId", "userId");

-- CreateIndex: WaiverSignature unique on [waiverPageId, userId, athleteId]
CREATE UNIQUE INDEX "WaiverSignature_waiverPageId_userId_athleteId_key" ON "WaiverSignature"("waiverPageId", "userId", "athleteId");

-- CreateIndex: WaiverAcceptance unique on [waiverId, userId, athleteId]
CREATE UNIQUE INDEX "WaiverAcceptance_waiverId_userId_athleteId_key" ON "WaiverAcceptance"("waiverId", "userId", "athleteId");

-- CreateIndex: NotificationDeduplication unique on [ruleId, entityType, entityId, userId]
CREATE UNIQUE INDEX "NotificationDeduplication_ruleId_entityType_entityId_userId_key" ON "NotificationDeduplication"("ruleId", "entityType", "entityId", "userId");

-- Indexes on new userId columns
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");
CREATE INDEX "InstanceRegistration_userId_idx" ON "InstanceRegistration"("userId");
CREATE INDEX "RecurringCharge_userId_idx" ON "RecurringCharge"("userId");
CREATE INDEX "SmsMessage_userId_idx" ON "SmsMessage"("userId");
CREATE INDEX "EmailMessage_userId_idx" ON "EmailMessage"("userId");
CREATE INDEX "WaiverSignature_userId_idx" ON "WaiverSignature"("userId");
CREATE INDEX "WaiverAcceptance_userId_idx" ON "WaiverAcceptance"("userId");

-- AddForeignKey: Athlete.userId -> User
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: AthleteGuardian.userId -> User
ALTER TABLE "AthleteGuardian" ADD CONSTRAINT "AthleteGuardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make AthleteGuardian.familyId FK optional
ALTER TABLE "AthleteGuardian" DROP CONSTRAINT IF EXISTS "AthleteGuardian_familyId_fkey";
ALTER TABLE "AthleteGuardian" ADD CONSTRAINT "AthleteGuardian_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PaymentMethod.userId -> User
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make PaymentMethod.familyId FK optional
ALTER TABLE "PaymentMethod" DROP CONSTRAINT IF EXISTS "PaymentMethod_familyId_fkey";
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Invoice.userId -> User
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make Invoice.familyId FK optional
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_familyId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Payment.userId -> User
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make Payment.familyId FK optional
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_familyId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Enrollment.userId -> User
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: InstanceRegistration.userId -> User
ALTER TABLE "InstanceRegistration" ADD CONSTRAINT "InstanceRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: RecurringCharge.userId -> User
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make RecurringCharge.familyId FK optional
ALTER TABLE "RecurringCharge" DROP CONSTRAINT IF EXISTS "RecurringCharge_familyId_fkey";
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SmsMessage.userId -> User
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: SmsConversation.userId -> User
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make SmsConversation.familyId FK optional
ALTER TABLE "SmsConversation" DROP CONSTRAINT IF EXISTS "SmsConversation_familyId_fkey";
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EmailMessage.userId -> User
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: WaiverSignature.userId -> User
ALTER TABLE "WaiverSignature" ADD CONSTRAINT "WaiverSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make WaiverSignature.familyId FK optional
ALTER TABLE "WaiverSignature" DROP CONSTRAINT IF EXISTS "WaiverSignature_familyId_fkey";
ALTER TABLE "WaiverSignature" ADD CONSTRAINT "WaiverSignature_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: WaiverAcceptance.userId -> User
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make WaiverAcceptance.familyId FK optional
ALTER TABLE "WaiverAcceptance" DROP CONSTRAINT IF EXISTS "WaiverAcceptance_familyId_fkey";
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GuardianClaimRequest
ALTER TABLE "GuardianClaimRequest" ADD CONSTRAINT "GuardianClaimRequest_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianClaimRequest" ADD CONSTRAINT "GuardianClaimRequest_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianClaimRequest" ADD CONSTRAINT "GuardianClaimRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: UserContact.userId -> User
ALTER TABLE "UserContact" ADD CONSTRAINT "UserContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: UserBillingAddress.userId -> User
ALTER TABLE "UserBillingAddress" ADD CONSTRAINT "UserBillingAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
