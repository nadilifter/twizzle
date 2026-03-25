-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationTriggerType" ADD VALUE 'RECURRING_CHARGE_UPCOMING';
ALTER TYPE "NotificationTriggerType" ADD VALUE 'RECURRING_CHARGE_SUCCEEDED';
ALTER TYPE "NotificationTriggerType" ADD VALUE 'RECURRING_CHARGE_FAILED';
ALTER TYPE "NotificationTriggerType" ADD VALUE 'RECURRING_CHARGE_SUSPENDED';

-- DropForeignKey
ALTER TABLE "OrganizationStatusLog" DROP CONSTRAINT "OrganizationStatusLog_performedBy_fkey";

-- AlterTable
ALTER TABLE "OrganizationPaymentMethod" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrganizationStatusLog" ALTER COLUMN "performedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "billingInterval" "BillingInterval" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN     "recurringPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "RecurringCharge" ADD COLUMN     "athleteMembershipId" TEXT,
ADD COLUMN     "athletePassId" TEXT,
ADD COLUMN     "enrollmentId" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "notes" TEXT,
    "voidedBy" TEXT,
    "voidedAt" TIMESTAMP(3),
    "adjustedFrom" DECIMAL(10,2),
    "markedPaidBy" TEXT,
    "markedPaidNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPaymentAttempt" (
    "id" TEXT NOT NULL,
    "subscriptionInvoiceId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "pspReference" TEXT,
    "failureReason" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_reference_key" ON "SubscriptionInvoice"("reference");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_organizationId_idx" ON "SubscriptionInvoice"("organizationId");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_status_idx" ON "SubscriptionInvoice"("status");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_periodStart_periodEnd_idx" ON "SubscriptionInvoice"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SubscriptionPaymentAttempt_subscriptionInvoiceId_idx" ON "SubscriptionPaymentAttempt"("subscriptionInvoiceId");

-- CreateIndex
CREATE INDEX "SubscriptionPaymentAttempt_paymentMethodId_idx" ON "SubscriptionPaymentAttempt"("paymentMethodId");

-- CreateIndex
CREATE INDEX "RecurringCharge_status_nextChargeDate_idx" ON "RecurringCharge"("status", "nextChargeDate");

-- AddForeignKey
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_athletePassId_fkey" FOREIGN KEY ("athletePassId") REFERENCES "AthletePass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_athleteMembershipId_fkey" FOREIGN KEY ("athleteMembershipId") REFERENCES "AthleteMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStatusLog" ADD CONSTRAINT "OrganizationStatusLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentAttempt" ADD CONSTRAINT "SubscriptionPaymentAttempt_subscriptionInvoiceId_fkey" FOREIGN KEY ("subscriptionInvoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentAttempt" ADD CONSTRAINT "SubscriptionPaymentAttempt_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "OrganizationPaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
