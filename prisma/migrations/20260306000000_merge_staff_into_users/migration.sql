-- Phase 1: Add new columns to OrganizationMember (all nullable for migration)
ALTER TABLE "OrganizationMember" ADD COLUMN "employmentType" "EmploymentType";
ALTER TABLE "OrganizationMember" ADD COLUMN "title" TEXT;
ALTER TABLE "OrganizationMember" ADD COLUMN "hourlyRate" DECIMAL(10,2);
ALTER TABLE "OrganizationMember" ADD COLUMN "hireDate" TIMESTAMP(3);
ALTER TABLE "OrganizationMember" ADD COLUMN "certifications" JSONB;
ALTER TABLE "OrganizationMember" ADD COLUMN "phone" TEXT;
ALTER TABLE "OrganizationMember" ADD COLUMN "emergencyContact" JSONB;

-- Phase 2: Create OrgMemberPermission table
CREATE TABLE "OrgMemberPermission" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    CONSTRAINT "OrgMemberPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrgMemberPermission_memberId_permission_key" ON "OrgMemberPermission"("memberId", "permission");
ALTER TABLE "OrgMemberPermission" ADD CONSTRAINT "OrgMemberPermission_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 3: Create MemberAvailability table
CREATE TABLE "MemberAvailability" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberAvailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberAvailability_memberId_dayOfWeek_key" ON "MemberAvailability"("memberId", "dayOfWeek");
CREATE INDEX "MemberAvailability_memberId_idx" ON "MemberAvailability"("memberId");
ALTER TABLE "MemberAvailability" ADD CONSTRAINT "MemberAvailability_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 4: Migrate StaffProfile data into OrganizationMember
UPDATE "OrganizationMember" om
SET
    "employmentType" = sp."employmentType",
    "title" = sp."title",
    "hourlyRate" = sp."hourlyRate",
    "hireDate" = sp."hireDate",
    "certifications" = sp."certifications",
    "phone" = sp."phone",
    "emergencyContact" = sp."emergencyContact"
FROM "StaffProfile" sp
WHERE om."userId" = sp."userId" AND om."organizationId" = sp."organizationId";

-- Phase 5: Migrate UserPermission -> OrgMemberPermission (for each org membership)
INSERT INTO "OrgMemberPermission" ("id", "memberId", "permission")
SELECT
    gen_random_uuid()::text,
    om."id",
    up."permission"
FROM "UserPermission" up
JOIN "OrganizationMember" om ON om."userId" = up."userId"
ON CONFLICT ("memberId", "permission") DO NOTHING;

-- Phase 6: Migrate StaffAvailability -> MemberAvailability
INSERT INTO "MemberAvailability" ("id", "memberId", "dayOfWeek", "startTime", "endTime", "isAvailable", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    om."id",
    sa."dayOfWeek",
    sa."startTime",
    sa."endTime",
    sa."isAvailable",
    sa."createdAt",
    sa."updatedAt"
FROM "StaffAvailability" sa
JOIN "StaffProfile" sp ON sp."id" = sa."staffProfileId"
JOIN "OrganizationMember" om ON om."userId" = sp."userId" AND om."organizationId" = sp."organizationId"
ON CONFLICT ("memberId", "dayOfWeek") DO NOTHING;

-- Phase 7: Add memberId columns to tables that reference StaffProfile
ALTER TABLE "EventStaff" ADD COLUMN "memberId" TEXT;
ALTER TABLE "ProgramStaff" ADD COLUMN "memberId" TEXT;
ALTER TABLE "Shift" ADD COLUMN "memberId" TEXT;
ALTER TABLE "ScheduleTemplateEntry" ADD COLUMN "memberId" TEXT;

-- Phase 8: Migrate FK data from staffProfileId -> memberId
UPDATE "EventStaff" es
SET "memberId" = om."id"
FROM "StaffProfile" sp
JOIN "OrganizationMember" om ON om."userId" = sp."userId" AND om."organizationId" = sp."organizationId"
WHERE es."staffProfileId" = sp."id";

UPDATE "ProgramStaff" ps
SET "memberId" = om."id"
FROM "StaffProfile" sp
JOIN "OrganizationMember" om ON om."userId" = sp."userId" AND om."organizationId" = sp."organizationId"
WHERE ps."staffProfileId" = sp."id";

UPDATE "Shift" s
SET "memberId" = om."id"
FROM "StaffProfile" sp
JOIN "OrganizationMember" om ON om."userId" = sp."userId" AND om."organizationId" = sp."organizationId"
WHERE s."staffProfileId" = sp."id";

UPDATE "ScheduleTemplateEntry" ste
SET "memberId" = ste."staffProfileId"
WHERE ste."staffProfileId" IS NOT NULL;
-- Note: ScheduleTemplateEntry.staffProfileId stored StaffProfile IDs, not OrganizationMember IDs.
-- Since this is a pre-customer DB, we'll clear these invalid references.
UPDATE "ScheduleTemplateEntry" SET "memberId" = NULL;

-- Phase 9: Make memberId required where needed (delete orphans first)
DELETE FROM "EventStaff" WHERE "memberId" IS NULL;
DELETE FROM "ProgramStaff" WHERE "memberId" IS NULL;
DELETE FROM "Shift" WHERE "memberId" IS NULL;

ALTER TABLE "EventStaff" ALTER COLUMN "memberId" SET NOT NULL;
ALTER TABLE "ProgramStaff" ALTER COLUMN "memberId" SET NOT NULL;
ALTER TABLE "Shift" ALTER COLUMN "memberId" SET NOT NULL;

-- Phase 10: Drop old FK constraints and columns
ALTER TABLE "EventStaff" DROP CONSTRAINT IF EXISTS "EventStaff_staffProfileId_fkey";
ALTER TABLE "ProgramStaff" DROP CONSTRAINT IF EXISTS "ProgramStaff_staffProfileId_fkey";
ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_staffProfileId_fkey";

DROP INDEX IF EXISTS "EventStaff_staffProfileId_idx";
DROP INDEX IF EXISTS "EventStaff_eventId_staffProfileId_key";
DROP INDEX IF EXISTS "ProgramStaff_staffProfileId_idx";
DROP INDEX IF EXISTS "ProgramStaff_programId_staffProfileId_key";
DROP INDEX IF EXISTS "Shift_staffProfileId_idx";

ALTER TABLE "EventStaff" DROP COLUMN "staffProfileId";
ALTER TABLE "ProgramStaff" DROP COLUMN "staffProfileId";
ALTER TABLE "Shift" DROP COLUMN "staffProfileId";
ALTER TABLE "ScheduleTemplateEntry" DROP COLUMN "staffProfileId";

-- Phase 11: Add new FK constraints and indexes
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "EventStaff_eventId_memberId_key" ON "EventStaff"("eventId", "memberId");
CREATE INDEX "EventStaff_memberId_idx" ON "EventStaff"("memberId");

ALTER TABLE "ProgramStaff" ADD CONSTRAINT "ProgramStaff_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProgramStaff_programId_memberId_key" ON "ProgramStaff"("programId", "memberId");
CREATE INDEX "ProgramStaff_memberId_idx" ON "ProgramStaff"("memberId");

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Shift_memberId_idx" ON "Shift"("memberId");

-- Phase 12: Remove staffProfileId from SmsMessage
ALTER TABLE "SmsMessage" DROP COLUMN IF EXISTS "staffProfileId";

-- Phase 13: Remove organizationId from User
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_organizationId_fkey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "organizationId";

-- Phase 14: Drop old tables
DROP TABLE IF EXISTS "StaffAvailability";
DROP TABLE IF EXISTS "StaffProfile";
DROP TABLE IF EXISTS "UserPermission";

-- Phase 15: Remove STAFF from Role enum
-- Reassign any existing STAFF role members to CUSTOM first
UPDATE "OrganizationMember" SET "role" = 'CUSTOM' WHERE "role" = 'STAFF';
UPDATE "OrganizationInvitation" SET "role" = 'CUSTOM' WHERE "role" = 'STAFF';
UPDATE "User" SET "role" = 'CUSTOM' WHERE "role" = 'STAFF';

-- Drop and recreate the enum without STAFF
-- Must drop defaults before casting column types
ALTER TABLE "OrganizationMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "OrganizationInvitation" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COACH', 'VOLUNTEER', 'ACCOUNTANT', 'CUSTOM', 'PARENT');

ALTER TABLE "OrganizationMember" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
ALTER TABLE "OrganizationInvitation" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";

ALTER TABLE "OrganizationMember" ALTER COLUMN "role" SET DEFAULT 'COACH'::"Role";
ALTER TABLE "OrganizationInvitation" ALTER COLUMN "role" SET DEFAULT 'COACH'::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'COACH'::"Role";

DROP TYPE "Role_old";
