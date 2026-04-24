-- USC-215: Add program draft state and split registration status into its own field.
--
-- Starting state:  ProgramStatus (ACTIVE | INACTIVE | ARCHIVED) + registrationOpen Boolean
-- Final state:     ProgramStatus (DRAFT | ACTIVE | COMPLETE) + RegistrationWindowStatus (OPEN | SCHEDULED | CLOSED)
--
-- Backfill logic:
--   registrationOpen=true                                     → status=ACTIVE,   registrationStatus=OPEN
--   registrationOpen=false + future registrationStartDate     → status=ACTIVE,   registrationStatus=SCHEDULED
--   registrationOpen=false + past registrationEndDate         → status=ACTIVE,   registrationStatus=CLOSED
--   registrationOpen=false + no dates (never opened)         → status=DRAFT,    registrationStatus=NULL
--   old status=INACTIVE                                       → status=ACTIVE,   registrationStatus=CLOSED
--   old status=ARCHIVED                                       → status=COMPLETE, registrationStatus=CLOSED

-- Step 1: Create RegistrationWindowStatus enum and add column (nullable, backfilled below)
CREATE TYPE "RegistrationWindowStatus" AS ENUM ('OPEN', 'SCHEDULED', 'CLOSED');
ALTER TABLE "Program" ADD COLUMN "registrationStatus" "RegistrationWindowStatus";

-- Step 2: Backfill registrationStatus from registrationOpen + date fields
UPDATE "Program" SET "registrationStatus" = 'OPEN'
  WHERE "registrationOpen" = true;

UPDATE "Program" SET "registrationStatus" = 'SCHEDULED'
  WHERE "registrationOpen" = false
    AND "registrationStartDate" IS NOT NULL
    AND "registrationStartDate" > NOW();

UPDATE "Program" SET "registrationStatus" = 'CLOSED'
  WHERE "registrationOpen" = false
    AND (
      ("registrationEndDate" IS NOT NULL AND "registrationEndDate" < NOW())
      OR "status"::text = 'INACTIVE'
      OR "status"::text = 'ARCHIVED'
    );
-- Programs with registrationOpen=false + no dates stay NULL (true draft state)

-- Step 3: Replace ProgramStatus enum and backfill status in one atomic block
BEGIN;
CREATE TYPE "ProgramStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETE');

ALTER TABLE "Program" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Program" ALTER COLUMN "status" TYPE "ProgramStatus_new" USING (
  CASE
    WHEN "status"::text = 'ARCHIVED'  THEN 'COMPLETE'::"ProgramStatus_new"
    WHEN "status"::text = 'INACTIVE'  THEN 'ACTIVE'::"ProgramStatus_new"
    WHEN "registrationOpen" = false
      AND "registrationStartDate" IS NULL
      AND ("registrationEndDate" IS NULL OR "registrationEndDate" > NOW())
      AND "status"::text = 'ACTIVE'   THEN 'DRAFT'::"ProgramStatus_new"
    ELSE 'ACTIVE'::"ProgramStatus_new"
  END
);

ALTER TYPE "ProgramStatus" RENAME TO "ProgramStatus_old";
ALTER TYPE "ProgramStatus_new" RENAME TO "ProgramStatus";
DROP TYPE "ProgramStatus_old";

ALTER TABLE "Program" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- Step 4: Drop registrationOpen now that both columns are backfilled
ALTER TABLE "Program" DROP COLUMN "registrationOpen";
