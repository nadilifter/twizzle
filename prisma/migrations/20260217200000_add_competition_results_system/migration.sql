-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('TIME', 'DISTANCE', 'HEIGHT', 'SCORE');

-- CreateEnum
CREATE TYPE "SortDirection" AS ENUM ('ASC', 'DESC');

-- CreateEnum
CREATE TYPE "SubmissionMode" AS ENUM ('NONE', 'VERIFIED_RESULT', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING_SEED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'SCRATCHED');

-- AlterTable: Add resultType and sortDirection to CategoryAxisValue
ALTER TABLE "CategoryAxisValue" ADD COLUMN "resultType" "ResultType",
ADD COLUMN "sortDirection" "SortDirection";

-- AlterTable: Add resultType and sortDirection to CategoryIndividualEntry
ALTER TABLE "CategoryIndividualEntry" ADD COLUMN "resultType" "ResultType",
ADD COLUMN "sortDirection" "SortDirection";

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "competitionType" TEXT NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "facilityId" TEXT,
    "country" TEXT,
    "stateProvince" TEXT,
    "city" TEXT,
    "streetAddress" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "categoryMode" TEXT NOT NULL DEFAULT 'ALL',
    "hasLevelRestriction" BOOLEAN NOT NULL DEFAULT false,
    "levelRequirementIds" TEXT[],
    "hasCapacityRestriction" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER,
    "hasAgeRestriction" BOOLEAN NOT NULL DEFAULT false,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "hasMembershipRestriction" BOOLEAN NOT NULL DEFAULT false,
    "membershipRequirementIds" TEXT[],
    "hasWaiverRestriction" BOOLEAN NOT NULL DEFAULT false,
    "waiverRequirementIds" TEXT[],
    "hasMedicalRequirement" BOOLEAN NOT NULL DEFAULT false,
    "publishStatus" TEXT,
    "scheduledGoLiveDate" TIMESTAMP(3),
    "scheduledGoLiveTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionCategory" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "combinationEntryId" TEXT,
    "individualEntryId" TEXT,
    "resultType" "ResultType" NOT NULL,
    "sortDirection" "SortDirection" NOT NULL DEFAULT 'ASC',
    "precision" INTEGER NOT NULL DEFAULT 3,
    "seedMarkRequired" BOOLEAN NOT NULL DEFAULT false,
    "submissionMode" "SubmissionMode" NOT NULL DEFAULT 'NONE',
    "qualifyingMark" DECIMAL(12,3),
    "isTeamEvent" BOOLEAN NOT NULL DEFAULT false,
    "teamSize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEntry" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "competitionCategoryId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "teamId" TEXT,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING_SEED',
    "seedMark" DECIMAL(12,3),
    "seedMarkSubmittedAt" TIMESTAMP(3),
    "seedMarkReviewedAt" TIMESTAMP(3),
    "seedMarkReviewedBy" TEXT,
    "seedMarkStatus" "SubmissionStatus",
    "seedMarkNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionTeam" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "competitionCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionResult" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "competitionCategoryId" TEXT NOT NULL,
    "athleteId" TEXT,
    "teamId" TEXT,
    "value" DECIMAL(12,3) NOT NULL,
    "displayValue" TEXT,
    "placement" INTEGER,
    "isPersonalBest" BOOLEAN NOT NULL DEFAULT false,
    "isDNF" BOOLEAN NOT NULL DEFAULT false,
    "isDNS" BOOLEAN NOT NULL DEFAULT false,
    "isDQ" BOOLEAN NOT NULL DEFAULT false,
    "attemptNumber" INTEGER,
    "isBestAttempt" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competition_organizationId_idx" ON "Competition"("organizationId");

-- CreateIndex
CREATE INDEX "Competition_status_idx" ON "Competition"("status");

-- CreateIndex
CREATE INDEX "CompetitionCategory_competitionId_idx" ON "CompetitionCategory"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionEntry_competitionCategoryId_athleteId_key" ON "CompetitionEntry"("competitionCategoryId", "athleteId");

-- CreateIndex
CREATE INDEX "CompetitionEntry_competitionId_idx" ON "CompetitionEntry"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionEntry_athleteId_idx" ON "CompetitionEntry"("athleteId");

-- CreateIndex
CREATE INDEX "CompetitionTeam_competitionId_idx" ON "CompetitionTeam"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionTeam_competitionCategoryId_idx" ON "CompetitionTeam"("competitionCategoryId");

-- CreateIndex
CREATE INDEX "CompetitionResult_competitionId_idx" ON "CompetitionResult"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionResult_competitionCategoryId_idx" ON "CompetitionResult"("competitionCategoryId");

-- CreateIndex
CREATE INDEX "CompetitionResult_athleteId_idx" ON "CompetitionResult"("athleteId");

-- CreateIndex
CREATE INDEX "CompetitionResult_competitionId_competitionCategoryId_place_idx" ON "CompetitionResult"("competitionId", "competitionCategoryId", "placement");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCategory" ADD CONSTRAINT "CompetitionCategory_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCategory" ADD CONSTRAINT "CompetitionCategory_combinationEntryId_fkey" FOREIGN KEY ("combinationEntryId") REFERENCES "CategoryCombinationEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCategory" ADD CONSTRAINT "CompetitionCategory_individualEntryId_fkey" FOREIGN KEY ("individualEntryId") REFERENCES "CategoryIndividualEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_competitionCategoryId_fkey" FOREIGN KEY ("competitionCategoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CompetitionTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionTeam" ADD CONSTRAINT "CompetitionTeam_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionTeam" ADD CONSTRAINT "CompetitionTeam_competitionCategoryId_fkey" FOREIGN KEY ("competitionCategoryId") REFERENCES "CompetitionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionTeam" ADD CONSTRAINT "CompetitionTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_competitionCategoryId_fkey" FOREIGN KEY ("competitionCategoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CompetitionTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
