-- CreateEnum
CREATE TYPE "WaiverStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "hasWaiverRestriction" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Waiver" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WaiverStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiverPage" (
    "id" TEXT NOT NULL,
    "waiverId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiverPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramWaiverRequirement" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "waiverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramWaiverRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiverSignature" (
    "id" TEXT NOT NULL,
    "waiverId" TEXT NOT NULL,
    "waiverPageId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedByName" TEXT NOT NULL,
    "signedByEmail" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaiverSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiverAcceptance" (
    "id" TEXT NOT NULL,
    "waiverId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaiverAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Waiver_organizationId_idx" ON "Waiver"("organizationId");

-- CreateIndex
CREATE INDEX "Waiver_status_idx" ON "Waiver"("status");

-- CreateIndex
CREATE INDEX "WaiverPage_waiverId_idx" ON "WaiverPage"("waiverId");

-- CreateIndex
CREATE INDEX "WaiverPage_waiverId_pageNumber_idx" ON "WaiverPage"("waiverId", "pageNumber");

-- CreateIndex
CREATE INDEX "ProgramWaiverRequirement_programId_idx" ON "ProgramWaiverRequirement"("programId");

-- CreateIndex
CREATE INDEX "ProgramWaiverRequirement_waiverId_idx" ON "ProgramWaiverRequirement"("waiverId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramWaiverRequirement_programId_waiverId_key" ON "ProgramWaiverRequirement"("programId", "waiverId");

-- CreateIndex
CREATE INDEX "WaiverSignature_waiverId_idx" ON "WaiverSignature"("waiverId");

-- CreateIndex
CREATE INDEX "WaiverSignature_waiverPageId_idx" ON "WaiverSignature"("waiverPageId");

-- CreateIndex
CREATE INDEX "WaiverSignature_familyId_idx" ON "WaiverSignature"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "WaiverSignature_waiverPageId_familyId_key" ON "WaiverSignature"("waiverPageId", "familyId");

-- CreateIndex
CREATE INDEX "WaiverAcceptance_waiverId_idx" ON "WaiverAcceptance"("waiverId");

-- CreateIndex
CREATE INDEX "WaiverAcceptance_familyId_idx" ON "WaiverAcceptance"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "WaiverAcceptance_waiverId_familyId_key" ON "WaiverAcceptance"("waiverId", "familyId");

-- AddForeignKey
ALTER TABLE "Waiver" ADD CONSTRAINT "Waiver_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverPage" ADD CONSTRAINT "WaiverPage_waiverId_fkey" FOREIGN KEY ("waiverId") REFERENCES "Waiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWaiverRequirement" ADD CONSTRAINT "ProgramWaiverRequirement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWaiverRequirement" ADD CONSTRAINT "ProgramWaiverRequirement_waiverId_fkey" FOREIGN KEY ("waiverId") REFERENCES "Waiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverSignature" ADD CONSTRAINT "WaiverSignature_waiverId_fkey" FOREIGN KEY ("waiverId") REFERENCES "Waiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverSignature" ADD CONSTRAINT "WaiverSignature_waiverPageId_fkey" FOREIGN KEY ("waiverPageId") REFERENCES "WaiverPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverSignature" ADD CONSTRAINT "WaiverSignature_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_waiverId_fkey" FOREIGN KEY ("waiverId") REFERENCES "Waiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
