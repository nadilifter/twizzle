-- Step 1: Add org-specific columns to OrganizationAthlete
ALTER TABLE "OrganizationAthlete" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'Unassigned';
ALTER TABLE "OrganizationAthlete" ADD COLUMN "status" "AthleteStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "OrganizationAthlete" ADD COLUMN "customId" TEXT;
ALTER TABLE "OrganizationAthlete" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Backfill from Athlete into OrganizationAthlete
UPDATE "OrganizationAthlete" oa
SET "level" = a."level",
    "status" = a."status",
    "customId" = a."customId"
FROM "Athlete" a
WHERE oa."athleteId" = a."id";

-- Step 3: Drop the direct organization FK from Athlete
ALTER TABLE "Athlete" DROP CONSTRAINT IF EXISTS "Athlete_organizationId_fkey";

-- Step 4: Drop the deprecated columns from Athlete
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "level";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "customId";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "organizationId";
