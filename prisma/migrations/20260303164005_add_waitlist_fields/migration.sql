-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'WAITLISTED';

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "waitlistAutoPromote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waitlistCapacity" INTEGER,
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false;
