-- CreateEnum
CREATE TYPE "TrainingZoneCapacityMode" AS ENUM ('MINIMUM', 'SUM');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "hasTrainingZoneRestriction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trainingZoneCapacityMode" "TrainingZoneCapacityMode" NOT NULL DEFAULT 'MINIMUM';

-- CreateTable
CREATE TABLE "ProgramTrainingZone" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "trainingZoneId" TEXT NOT NULL,

    CONSTRAINT "ProgramTrainingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramInstanceTrainingZone" (
    "id" TEXT NOT NULL,
    "programInstanceId" TEXT NOT NULL,
    "trainingZoneId" TEXT NOT NULL,

    CONSTRAINT "ProgramInstanceTrainingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingZoneAvailability" (
    "id" TEXT NOT NULL,
    "trainingZoneId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,

    CONSTRAINT "TrainingZoneAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramTrainingZone_programId_idx" ON "ProgramTrainingZone"("programId");

-- CreateIndex
CREATE INDEX "ProgramTrainingZone_trainingZoneId_idx" ON "ProgramTrainingZone"("trainingZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTrainingZone_programId_trainingZoneId_key" ON "ProgramTrainingZone"("programId", "trainingZoneId");

-- CreateIndex
CREATE INDEX "ProgramInstanceTrainingZone_programInstanceId_idx" ON "ProgramInstanceTrainingZone"("programInstanceId");

-- CreateIndex
CREATE INDEX "ProgramInstanceTrainingZone_trainingZoneId_idx" ON "ProgramInstanceTrainingZone"("trainingZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramInstanceTrainingZone_programInstanceId_trainingZoneI_key" ON "ProgramInstanceTrainingZone"("programInstanceId", "trainingZoneId");

-- CreateIndex
CREATE INDEX "TrainingZoneAvailability_trainingZoneId_idx" ON "TrainingZoneAvailability"("trainingZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingZoneAvailability_trainingZoneId_dayOfWeek_key" ON "TrainingZoneAvailability"("trainingZoneId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "ProgramTrainingZone" ADD CONSTRAINT "ProgramTrainingZone_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTrainingZone" ADD CONSTRAINT "ProgramTrainingZone_trainingZoneId_fkey" FOREIGN KEY ("trainingZoneId") REFERENCES "TrainingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramInstanceTrainingZone" ADD CONSTRAINT "ProgramInstanceTrainingZone_programInstanceId_fkey" FOREIGN KEY ("programInstanceId") REFERENCES "ProgramInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramInstanceTrainingZone" ADD CONSTRAINT "ProgramInstanceTrainingZone_trainingZoneId_fkey" FOREIGN KEY ("trainingZoneId") REFERENCES "TrainingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingZoneAvailability" ADD CONSTRAINT "TrainingZoneAvailability_trainingZoneId_fkey" FOREIGN KEY ("trainingZoneId") REFERENCES "TrainingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
