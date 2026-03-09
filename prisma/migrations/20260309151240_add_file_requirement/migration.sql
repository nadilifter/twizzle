-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "fileRequirementConfig" JSONB,
ADD COLUMN     "hasFileRequirement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "fileRequirementConfig" JSONB,
ADD COLUMN     "hasFileRequirement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "fileRequirementConfig" JSONB,
ADD COLUMN     "hasFileRequirement" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RegistrationFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "programId" TEXT,
    "competitionId" TEXT,
    "eventId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationFile_organizationId_idx" ON "RegistrationFile"("organizationId");

-- CreateIndex
CREATE INDEX "RegistrationFile_athleteId_idx" ON "RegistrationFile"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFile_athleteId_programId_key" ON "RegistrationFile"("athleteId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFile_athleteId_competitionId_key" ON "RegistrationFile"("athleteId", "competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFile_athleteId_eventId_key" ON "RegistrationFile"("athleteId", "eventId");

-- AddForeignKey
ALTER TABLE "RegistrationFile" ADD CONSTRAINT "RegistrationFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFile" ADD CONSTRAINT "RegistrationFile_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFile" ADD CONSTRAINT "RegistrationFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFile" ADD CONSTRAINT "RegistrationFile_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFile" ADD CONSTRAINT "RegistrationFile_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFile" ADD CONSTRAINT "RegistrationFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
