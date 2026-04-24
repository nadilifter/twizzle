/*
  Warnings:

  - The values [PAYMENT_PENDING] on the enum `EnrollmentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EnrollmentStatus_new" AS ENUM ('ACTIVE', 'WAITLISTED', 'WAITLIST_PAYMENT_PENDING', 'PAUSED', 'CANCELLED', 'COMPLETED');
ALTER TABLE "public"."Enrollment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Enrollment" ALTER COLUMN "status" TYPE "EnrollmentStatus_new" USING ("status"::text::"EnrollmentStatus_new");
ALTER TYPE "EnrollmentStatus" RENAME TO "EnrollmentStatus_old";
ALTER TYPE "EnrollmentStatus_new" RENAME TO "EnrollmentStatus";
DROP TYPE "public"."EnrollmentStatus_old";
ALTER TABLE "Enrollment" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;
