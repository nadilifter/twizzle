-- CreateEnum
CREATE TYPE "Federation" AS ENUM ('SKATE_CANADA', 'USFS', 'ISU');

-- CreateEnum
CREATE TYPE "FederationSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "FederationSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "federation" "Federation" NOT NULL,
    "status" "FederationSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "payload" JSONB NOT NULL,
    "externalRef" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedById" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederationSubmissionAthlete" (
    "submissionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,

    CONSTRAINT "FederationSubmissionAthlete_pkey" PRIMARY KEY ("submissionId","athleteId")
);

-- CreateIndex
CREATE INDEX "FederationSubmission_organizationId_status_idx" ON "FederationSubmission"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FederationSubmission_federation_status_idx" ON "FederationSubmission"("federation", "status");

-- CreateIndex
CREATE INDEX "FederationSubmissionAthlete_athleteId_idx" ON "FederationSubmissionAthlete"("athleteId");

-- AddForeignKey
ALTER TABLE "FederationSubmission" ADD CONSTRAINT "FederationSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationSubmission" ADD CONSTRAINT "FederationSubmission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationSubmission" ADD CONSTRAINT "FederationSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationSubmission" ADD CONSTRAINT "FederationSubmission_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationSubmissionAthlete" ADD CONSTRAINT "FederationSubmissionAthlete_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FederationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationSubmissionAthlete" ADD CONSTRAINT "FederationSubmissionAthlete_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
