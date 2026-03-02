-- Data migration: preserve attendance data before removing enum values
-- For registrations marked ATTENDED without a matching InstanceAttendance, create one with PRESENT
INSERT INTO "InstanceAttendance" ("id", "programInstanceId", "athleteId", "status", "checkedIn", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  ir."programInstanceId",
  ir."athleteId",
  'PRESENT'::"AttendanceStatus",
  ir."updatedAt",
  NOW(),
  NOW()
FROM "InstanceRegistration" ir
WHERE ir."status" = 'ATTENDED'
  AND NOT EXISTS (
    SELECT 1 FROM "InstanceAttendance" ia
    WHERE ia."programInstanceId" = ir."programInstanceId"
      AND ia."athleteId" = ir."athleteId"
  );

-- For registrations marked NO_SHOW without a matching InstanceAttendance, create one with ABSENT
INSERT INTO "InstanceAttendance" ("id", "programInstanceId", "athleteId", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  ir."programInstanceId",
  ir."athleteId",
  'ABSENT'::"AttendanceStatus",
  NOW(),
  NOW()
FROM "InstanceRegistration" ir
WHERE ir."status" = 'NO_SHOW'
  AND NOT EXISTS (
    SELECT 1 FROM "InstanceAttendance" ia
    WHERE ia."programInstanceId" = ir."programInstanceId"
      AND ia."athleteId" = ir."athleteId"
  );

-- Reset all ATTENDED/NO_SHOW registrations back to REGISTERED
UPDATE "InstanceRegistration" SET "status" = 'REGISTERED' WHERE "status" IN ('ATTENDED', 'NO_SHOW');

-- Now safe to remove the enum values
ALTER TYPE "RegistrationStatus" RENAME TO "RegistrationStatus_old";
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELLED');
ALTER TABLE "InstanceRegistration" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "InstanceRegistration" ALTER COLUMN "status" TYPE "RegistrationStatus" USING ("status"::text::"RegistrationStatus");
ALTER TABLE "InstanceRegistration" ALTER COLUMN "status" SET DEFAULT 'REGISTERED';
DROP TYPE "RegistrationStatus_old";
