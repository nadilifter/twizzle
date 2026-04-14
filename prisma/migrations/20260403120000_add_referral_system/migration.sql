-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "referralCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_referralCode_key" ON "Organization"("referralCode");

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerOrganizationId" TEXT NOT NULL,
    "referredOrganizationId" TEXT NOT NULL,
    "creditMonths" INTEGER NOT NULL DEFAULT 1,
    "creditMonthsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_referrerOrganizationId_idx" ON "Referral"("referrerOrganizationId");

-- CreateIndex
CREATE INDEX "Referral_referredOrganizationId_idx" ON "Referral"("referredOrganizationId");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerOrganizationId_fkey" FOREIGN KEY ("referrerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredOrganizationId_fkey" FOREIGN KEY ("referredOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
