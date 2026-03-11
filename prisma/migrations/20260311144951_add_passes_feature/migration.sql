-- CreateEnum
CREATE TYPE "PassLimitPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "InstanceRegistration" ADD COLUMN     "passId" TEXT;

-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "passId" TEXT;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "hasPassRestriction" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Pass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "sessionLimit" INTEGER NOT NULL,
    "limitPeriod" "PassLimitPeriod" NOT NULL DEFAULT 'WEEKLY',
    "status" "PassStatus" NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthletePass" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "userId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "PassStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthletePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PassCoveredPrograms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PassCoveredPrograms_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PassRequiredForPrograms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PassRequiredForPrograms_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Pass_organizationId_idx" ON "Pass"("organizationId");

-- CreateIndex
CREATE INDEX "Pass_status_idx" ON "Pass"("status");

-- CreateIndex
CREATE INDEX "AthletePass_passId_idx" ON "AthletePass"("passId");

-- CreateIndex
CREATE INDEX "AthletePass_athleteId_idx" ON "AthletePass"("athleteId");

-- CreateIndex
CREATE INDEX "AthletePass_userId_idx" ON "AthletePass"("userId");

-- CreateIndex
CREATE INDEX "AthletePass_status_idx" ON "AthletePass"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AthletePass_passId_athleteId_key" ON "AthletePass"("passId", "athleteId");

-- CreateIndex
CREATE INDEX "_PassCoveredPrograms_B_index" ON "_PassCoveredPrograms"("B");

-- CreateIndex
CREATE INDEX "_PassRequiredForPrograms_B_index" ON "_PassRequiredForPrograms"("B");

-- CreateIndex
CREATE INDEX "InstanceRegistration_passId_idx" ON "InstanceRegistration"("passId");

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_passId_fkey" FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthletePass" ADD CONSTRAINT "AthletePass_passId_fkey" FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthletePass" ADD CONSTRAINT "AthletePass_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthletePass" ADD CONSTRAINT "AthletePass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PassCoveredPrograms" ADD CONSTRAINT "_PassCoveredPrograms_A_fkey" FOREIGN KEY ("A") REFERENCES "Pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PassCoveredPrograms" ADD CONSTRAINT "_PassCoveredPrograms_B_fkey" FOREIGN KEY ("B") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PassRequiredForPrograms" ADD CONSTRAINT "_PassRequiredForPrograms_A_fkey" FOREIGN KEY ("A") REFERENCES "Pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PassRequiredForPrograms" ADD CONSTRAINT "_PassRequiredForPrograms_B_fkey" FOREIGN KEY ("B") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
