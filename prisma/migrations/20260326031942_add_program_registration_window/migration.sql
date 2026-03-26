-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "earlyAccessCode" TEXT,
ADD COLUMN     "registrationEndDate" TIMESTAMP(3),
ADD COLUMN     "registrationEndTime" TEXT,
ADD COLUMN     "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "registrationStartDate" TIMESTAMP(3),
ADD COLUMN     "registrationStartTime" TEXT;
