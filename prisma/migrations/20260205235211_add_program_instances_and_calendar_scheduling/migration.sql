-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NON_RECURRING', 'RECURRING');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('ALL_INSTANCES', 'PER_INSTANCE');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "facilityId" TEXT,
ADD COLUMN     "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'RECURRING',
ADD COLUMN     "registrationType" "RegistrationType",
ADD COLUMN     "rrule" TEXT,
ADD COLUMN     "startTime" TEXT;

-- CreateTable
CREATE TABLE "ProgramInstance" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "facilityId" TEXT,
    "capacity" INTEGER,
    "status" "InstanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceRegistration" (
    "id" TEXT NOT NULL,
    "programInstanceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "familyId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceAttendance" (
    "id" TEXT NOT NULL,
    "programInstanceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'REGISTERED',
    "checkedIn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramInstance_programId_idx" ON "ProgramInstance"("programId");

-- CreateIndex
CREATE INDEX "ProgramInstance_facilityId_idx" ON "ProgramInstance"("facilityId");

-- CreateIndex
CREATE INDEX "ProgramInstance_organizationId_idx" ON "ProgramInstance"("organizationId");

-- CreateIndex
CREATE INDEX "ProgramInstance_date_idx" ON "ProgramInstance"("date");

-- CreateIndex
CREATE INDEX "ProgramInstance_status_idx" ON "ProgramInstance"("status");

-- CreateIndex
CREATE INDEX "InstanceRegistration_programInstanceId_idx" ON "InstanceRegistration"("programInstanceId");

-- CreateIndex
CREATE INDEX "InstanceRegistration_athleteId_idx" ON "InstanceRegistration"("athleteId");

-- CreateIndex
CREATE INDEX "InstanceRegistration_familyId_idx" ON "InstanceRegistration"("familyId");

-- CreateIndex
CREATE INDEX "InstanceRegistration_status_idx" ON "InstanceRegistration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceRegistration_programInstanceId_athleteId_key" ON "InstanceRegistration"("programInstanceId", "athleteId");

-- CreateIndex
CREATE INDEX "InstanceAttendance_programInstanceId_idx" ON "InstanceAttendance"("programInstanceId");

-- CreateIndex
CREATE INDEX "InstanceAttendance_athleteId_idx" ON "InstanceAttendance"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceAttendance_programInstanceId_athleteId_key" ON "InstanceAttendance"("programInstanceId", "athleteId");

-- CreateIndex
CREATE INDEX "Program_facilityId_idx" ON "Program"("facilityId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramInstance" ADD CONSTRAINT "ProgramInstance_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramInstance" ADD CONSTRAINT "ProgramInstance_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramInstance" ADD CONSTRAINT "ProgramInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceRegistration" ADD CONSTRAINT "InstanceRegistration_programInstanceId_fkey" FOREIGN KEY ("programInstanceId") REFERENCES "ProgramInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceRegistration" ADD CONSTRAINT "InstanceRegistration_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceRegistration" ADD CONSTRAINT "InstanceRegistration_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceAttendance" ADD CONSTRAINT "InstanceAttendance_programInstanceId_fkey" FOREIGN KEY ("programInstanceId") REFERENCES "ProgramInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceAttendance" ADD CONSTRAINT "InstanceAttendance_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
