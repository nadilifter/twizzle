-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_membershipTierId_fkey";

-- DropForeignKey
ALTER TABLE "MembershipTier" DROP CONSTRAINT IF EXISTS "MembershipTier_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "MembershipTier" DROP CONSTRAINT IF EXISTS "MembershipTier_programId_fkey";

-- DropForeignKey
ALTER TABLE "Program" DROP CONSTRAINT IF EXISTS "Program_levelId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Program_levelId_idx";

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN IF EXISTS "membershipTierId";

-- AlterTable
ALTER TABLE "Program" DROP COLUMN IF EXISTS "level",
DROP COLUMN IF EXISTS "levelId",
DROP COLUMN IF EXISTS "programType",
DROP COLUMN IF EXISTS "schedulePattern",
DROP COLUMN IF EXISTS "showLevelOnSite";

-- DropTable
DROP TABLE IF EXISTS "MembershipTier";

-- DropEnum
DROP TYPE IF EXISTS "ProgramType";
