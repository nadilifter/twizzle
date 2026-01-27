-- DropForeignKey
ALTER TABLE "Athlete" DROP CONSTRAINT "Athlete_familyId_fkey";

-- AlterTable
ALTER TABLE "Athlete" ALTER COLUMN "familyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "familyId" TEXT;

-- CreateTable
CREATE TABLE "AthleteGuardian" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AthleteGuardian_athleteId_familyId_key" ON "AthleteGuardian"("athleteId", "familyId");

-- AddForeignKey
ALTER TABLE "AthleteGuardian" ADD CONSTRAINT "AthleteGuardian_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGuardian" ADD CONSTRAINT "AthleteGuardian_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
