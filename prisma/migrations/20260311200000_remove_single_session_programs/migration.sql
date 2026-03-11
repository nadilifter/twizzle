-- Convert any NON_RECURRING programs to Events before dropping the column/enum.
-- Each single-session program becomes an Event with type 'CLASS'.

-- Step 1: Insert Events from NON_RECURRING programs + their single ProgramInstance
INSERT INTO "Event" (
  "id", "title", "color", "date", "startTime", "endTime",
  "type", "description", "capacity", "facilityId",
  "hasFileRequirement", "fileRequirementConfig",
  "organizationId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."name",
  p."color",
  COALESCE(pi."date", p."startDate", NOW()),
  COALESCE(pi."startTime", p."startTime", '09:00'),
  COALESCE(pi."endTime", '10:00'),
  'CLASS'::"EventType",
  p."description",
  COALESCE(pi."capacity", p."capacity"),
  COALESCE(pi."facilityId", p."facilityId"),
  p."hasFileRequirement",
  p."fileRequirementConfig",
  p."organizationId",
  p."createdAt",
  NOW()
FROM "Program" p
LEFT JOIN "ProgramInstance" pi ON pi."programId" = p."id"
WHERE p."recurrenceType" = 'NON_RECURRING';

-- Step 2: Migrate staff assignments (ProgramStaff -> EventStaff) for converted programs
INSERT INTO "EventStaff" (
  "id", "eventId", "memberId", "role", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  e."id",
  ps."memberId",
  CASE ps."role"
    WHEN 'LEAD_COACH' THEN 'LEAD'::"EventStaffRole"
    WHEN 'ASSISTANT_COACH' THEN 'ASSISTANT'::"EventStaffRole"
    WHEN 'SUBSTITUTE' THEN 'ASSISTANT'::"EventStaffRole"
    WHEN 'VOLUNTEER' THEN 'VOLUNTEER'::"EventStaffRole"
    ELSE 'ASSISTANT'::"EventStaffRole"
  END,
  NOW(),
  NOW()
FROM "ProgramStaff" ps
JOIN "Program" p ON p."id" = ps."programId"
JOIN "Event" e ON e."title" = p."name"
  AND e."organizationId" = p."organizationId"
  AND e."type" = 'CLASS'
WHERE p."recurrenceType" = 'NON_RECURRING';

-- Step 3: Migrate InstanceRegistrations -> Attendance for converted programs
INSERT INTO "Attendance" (
  "id", "eventId", "athleteId", "status", "checkedIn", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  e."id",
  ir."athleteId",
  CASE ir."status"
    WHEN 'REGISTERED' THEN 'REGISTERED'::"AttendanceStatus"
    WHEN 'WAITLISTED' THEN 'REGISTERED'::"AttendanceStatus"
    ELSE 'REGISTERED'::"AttendanceStatus"
  END,
  NULL,
  ir."createdAt",
  NOW()
FROM "InstanceRegistration" ir
JOIN "ProgramInstance" pi ON pi."id" = ir."programInstanceId"
JOIN "Program" p ON p."id" = pi."programId"
JOIN "Event" e ON e."title" = p."name"
  AND e."organizationId" = p."organizationId"
  AND e."type" = 'CLASS'
WHERE p."recurrenceType" = 'NON_RECURRING'
  AND ir."status" != 'CANCELLED';

-- Step 4: Clean up converted programs' dependent records
DELETE FROM "InstanceAttendance"
WHERE "programInstanceId" IN (
  SELECT pi."id" FROM "ProgramInstance" pi
  JOIN "Program" p ON p."id" = pi."programId"
  WHERE p."recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "InstanceRegistration"
WHERE "programInstanceId" IN (
  SELECT pi."id" FROM "ProgramInstance" pi
  JOIN "Program" p ON p."id" = pi."programId"
  WHERE p."recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "ProgramInstanceTrainingZone"
WHERE "programInstanceId" IN (
  SELECT pi."id" FROM "ProgramInstance" pi
  JOIN "Program" p ON p."id" = pi."programId"
  WHERE p."recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "ProgramInstance"
WHERE "programId" IN (
  SELECT "id" FROM "Program" WHERE "recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "ProgramStaff"
WHERE "programId" IN (
  SELECT "id" FROM "Program" WHERE "recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "ProgramLevelRequirement"
WHERE "programId" IN (
  SELECT "id" FROM "Program" WHERE "recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "ProgramWaiverRequirement"
WHERE "programId" IN (
  SELECT "id" FROM "Program" WHERE "recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "ProgramTrainingZone"
WHERE "programId" IN (
  SELECT "id" FROM "Program" WHERE "recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "ProgramBulkDiscount"
WHERE "programId" IN (
  SELECT "id" FROM "Program" WHERE "recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "Enrollment"
WHERE "programId" IN (
  SELECT "id" FROM "Program" WHERE "recurrenceType" = 'NON_RECURRING'
);

DELETE FROM "Program"
WHERE "recurrenceType" = 'NON_RECURRING';

-- Step 5: Set registrationType to ALL_INSTANCES for any programs that have it NULL
UPDATE "Program"
SET "registrationType" = 'ALL_INSTANCES'
WHERE "registrationType" IS NULL;

-- Step 6: Drop the recurrenceType column
ALTER TABLE "Program" DROP COLUMN "recurrenceType";

-- Step 7: Make registrationType non-nullable with default
ALTER TABLE "Program" ALTER COLUMN "registrationType" SET NOT NULL;
ALTER TABLE "Program" ALTER COLUMN "registrationType" SET DEFAULT 'ALL_INSTANCES';

-- Step 8: Drop the RecurrenceType enum
DROP TYPE "RecurrenceType";
