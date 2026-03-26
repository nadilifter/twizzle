-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "earlyAccessCode" TEXT,
ADD COLUMN     "registrationEndDate" TIMESTAMP(3),
ADD COLUMN     "registrationEndTime" TEXT,
ADD COLUMN     "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "registrationStartDate" TIMESTAMP(3),
ADD COLUMN     "registrationStartTime" TEXT;

-- AlterTable
ALTER TABLE "MembershipInstance" ADD COLUMN     "earlyAccessCode" TEXT,
ADD COLUMN     "registrationEndDate" TIMESTAMP(3),
ADD COLUMN     "registrationEndTime" TEXT,
ADD COLUMN     "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "registrationStartDate" TIMESTAMP(3),
ADD COLUMN     "registrationStartTime" TEXT;
