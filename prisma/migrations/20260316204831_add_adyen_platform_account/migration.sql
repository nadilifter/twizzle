-- CreateEnum
CREATE TYPE "AdyenOnboardingStatus" AS ENUM ('PENDING_HOSTED', 'IN_PROGRESS', 'AWAITING_DATA', 'IN_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "AdyenPlatformAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "businessLineId" TEXT,
    "accountHolderId" TEXT,
    "balanceAccountId" TEXT,
    "storeId" TEXT,
    "storeReference" TEXT,
    "onboardingStatus" "AdyenOnboardingStatus" NOT NULL DEFAULT 'PENDING_HOSTED',
    "verificationStatus" TEXT,
    "capabilities" JSONB,
    "sweepId" TEXT,
    "transferInstrumentId" TEXT,
    "splitConfigurationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdyenPlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdyenPlatformAccount_organizationId_key" ON "AdyenPlatformAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdyenPlatformAccount_legalEntityId_key" ON "AdyenPlatformAccount"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "AdyenPlatformAccount_accountHolderId_key" ON "AdyenPlatformAccount"("accountHolderId");

-- CreateIndex
CREATE UNIQUE INDEX "AdyenPlatformAccount_balanceAccountId_key" ON "AdyenPlatformAccount"("balanceAccountId");

-- CreateIndex
CREATE INDEX "AdyenPlatformAccount_legalEntityId_idx" ON "AdyenPlatformAccount"("legalEntityId");

-- CreateIndex
CREATE INDEX "AdyenPlatformAccount_accountHolderId_idx" ON "AdyenPlatformAccount"("accountHolderId");

-- RenameForeignKey
ALTER TABLE "Equipment" RENAME CONSTRAINT "Equipment_trainingZoneId_fkey" TO "Equipment_spaceId_fkey";

-- AddForeignKey
ALTER TABLE "AdyenPlatformAccount" ADD CONSTRAINT "AdyenPlatformAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Equipment_trainingZoneId_idx" RENAME TO "Equipment_spaceId_idx";
