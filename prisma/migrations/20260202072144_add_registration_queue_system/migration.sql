-- CreateEnum
CREATE TYPE "QueueActivationType" AS ENUM ('ALWAYS', 'THRESHOLD', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('WAITING', 'ADMITTED', 'COMPLETED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "RegistrationQueueConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reservationMinutes" INTEGER NOT NULL DEFAULT 10,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 50,
    "activationType" "QueueActivationType" NOT NULL DEFAULT 'ALWAYS',
    "activationThreshold" INTEGER,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationQueueConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "queueConfigId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "email" TEXT,
    "familyId" TEXT,
    "position" INTEGER NOT NULL,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'WAITING',
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admittedAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueReservation" (
    "id" TEXT NOT NULL,
    "queueEntryId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationQueueConfig_organizationId_idx" ON "RegistrationQueueConfig"("organizationId");

-- CreateIndex
CREATE INDEX "RegistrationQueueConfig_programId_idx" ON "RegistrationQueueConfig"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationQueueConfig_organizationId_programId_key" ON "RegistrationQueueConfig"("organizationId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_sessionToken_key" ON "QueueEntry"("sessionToken");

-- CreateIndex
CREATE INDEX "QueueEntry_queueConfigId_status_idx" ON "QueueEntry"("queueConfigId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_sessionToken_idx" ON "QueueEntry"("sessionToken");

-- CreateIndex
CREATE INDEX "QueueEntry_status_idx" ON "QueueEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QueueReservation_queueEntryId_key" ON "QueueReservation"("queueEntryId");

-- CreateIndex
CREATE INDEX "QueueReservation_programId_status_idx" ON "QueueReservation"("programId", "status");

-- CreateIndex
CREATE INDEX "QueueReservation_expiresAt_idx" ON "QueueReservation"("expiresAt");

-- CreateIndex
CREATE INDEX "QueueReservation_status_idx" ON "QueueReservation"("status");

-- AddForeignKey
ALTER TABLE "RegistrationQueueConfig" ADD CONSTRAINT "RegistrationQueueConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationQueueConfig" ADD CONSTRAINT "RegistrationQueueConfig_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_queueConfigId_fkey" FOREIGN KEY ("queueConfigId") REFERENCES "RegistrationQueueConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueReservation" ADD CONSTRAINT "QueueReservation_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueReservation" ADD CONSTRAINT "QueueReservation_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
