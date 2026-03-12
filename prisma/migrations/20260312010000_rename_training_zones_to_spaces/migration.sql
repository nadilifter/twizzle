-- Rename all TrainingZone-related DB objects to use "Space" naming.
-- This aligns the DB with the Prisma model names and removes the need for @@map.

-- Step 1: Rename columns (must happen before table renames for FK references)
ALTER TABLE "ProgramTrainingZone" RENAME COLUMN "trainingZoneId" TO "spaceId";
ALTER TABLE "ProgramInstanceTrainingZone" RENAME COLUMN "trainingZoneId" TO "spaceId";
ALTER TABLE "TrainingZoneAvailability" RENAME COLUMN "trainingZoneId" TO "spaceId";
ALTER TABLE "Equipment" RENAME COLUMN "trainingZoneId" TO "spaceId";
ALTER TABLE "Program" RENAME COLUMN "hasTrainingZoneRestriction" TO "hasSpaceRestriction";
ALTER TABLE "Program" RENAME COLUMN "trainingZoneCapacityMode" TO "spaceCapacityMode";

-- Step 2: Rename tables
ALTER TABLE "TrainingZone" RENAME TO "Space";
ALTER TABLE "ProgramTrainingZone" RENAME TO "ProgramSpace";
ALTER TABLE "ProgramInstanceTrainingZone" RENAME TO "ProgramInstanceSpace";
ALTER TABLE "TrainingZoneAvailability" RENAME TO "SpaceAvailability";

-- Step 3: Rename enums
ALTER TYPE "ZoneStatus" RENAME TO "SpaceStatus";
ALTER TYPE "TrainingZoneCapacityMode" RENAME TO "SpaceCapacityMode";

-- Step 4: Rename indexes to match new table/column names
ALTER INDEX "TrainingZone_pkey" RENAME TO "Space_pkey";
ALTER INDEX "TrainingZone_facilityId_idx" RENAME TO "Space_facilityId_idx";

ALTER INDEX "ProgramTrainingZone_pkey" RENAME TO "ProgramSpace_pkey";
ALTER INDEX "ProgramTrainingZone_programId_idx" RENAME TO "ProgramSpace_programId_idx";
ALTER INDEX "ProgramTrainingZone_trainingZoneId_idx" RENAME TO "ProgramSpace_spaceId_idx";
ALTER INDEX "ProgramTrainingZone_programId_trainingZoneId_key" RENAME TO "ProgramSpace_programId_spaceId_key";

ALTER INDEX "ProgramInstanceTrainingZone_pkey" RENAME TO "ProgramInstanceSpace_pkey";
ALTER INDEX "ProgramInstanceTrainingZone_programInstanceId_idx" RENAME TO "ProgramInstanceSpace_programInstanceId_idx";
ALTER INDEX "ProgramInstanceTrainingZone_trainingZoneId_idx" RENAME TO "ProgramInstanceSpace_spaceId_idx";
ALTER INDEX "ProgramInstanceTrainingZone_programInstanceId_trainingZoneI_key" RENAME TO "ProgramInstanceSpace_programInstanceId_spaceId_key";

ALTER INDEX "TrainingZoneAvailability_pkey" RENAME TO "SpaceAvailability_pkey";
ALTER INDEX "TrainingZoneAvailability_trainingZoneId_idx" RENAME TO "SpaceAvailability_spaceId_idx";
ALTER INDEX "TrainingZoneAvailability_trainingZoneId_dayOfWeek_key" RENAME TO "SpaceAvailability_spaceId_dayOfWeek_key";

-- Step 5: Rename foreign key constraints
ALTER TABLE "Space" RENAME CONSTRAINT "TrainingZone_facilityId_fkey" TO "Space_facilityId_fkey";
ALTER TABLE "ProgramSpace" RENAME CONSTRAINT "ProgramTrainingZone_programId_fkey" TO "ProgramSpace_programId_fkey";
ALTER TABLE "ProgramSpace" RENAME CONSTRAINT "ProgramTrainingZone_trainingZoneId_fkey" TO "ProgramSpace_spaceId_fkey";
ALTER TABLE "ProgramInstanceSpace" RENAME CONSTRAINT "ProgramInstanceTrainingZone_programInstanceId_fkey" TO "ProgramInstanceSpace_programInstanceId_fkey";
ALTER TABLE "ProgramInstanceSpace" RENAME CONSTRAINT "ProgramInstanceTrainingZone_trainingZoneId_fkey" TO "ProgramInstanceSpace_spaceId_fkey";
ALTER TABLE "SpaceAvailability" RENAME CONSTRAINT "TrainingZoneAvailability_trainingZoneId_fkey" TO "SpaceAvailability_spaceId_fkey";
