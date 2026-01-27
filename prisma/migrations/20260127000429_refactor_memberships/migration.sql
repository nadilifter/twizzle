-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "customId" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "MembershipGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "programTypes" TEXT[],
    "allowAutoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipInstance" (
    "id" TEXT NOT NULL,
    "membershipGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "autoRenewDate" TIMESTAMP(3),
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteMembership" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "membershipInstanceId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteMembership_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipGroup" ADD CONSTRAINT "MembershipGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInstance" ADD CONSTRAINT "MembershipInstance_membershipGroupId_fkey" FOREIGN KEY ("membershipGroupId") REFERENCES "MembershipGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMembership" ADD CONSTRAINT "AthleteMembership_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMembership" ADD CONSTRAINT "AthleteMembership_membershipInstanceId_fkey" FOREIGN KEY ("membershipInstanceId") REFERENCES "MembershipInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
