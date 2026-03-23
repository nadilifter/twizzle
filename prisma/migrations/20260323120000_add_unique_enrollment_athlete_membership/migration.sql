-- Clean up any existing duplicate Enrollment rows before adding constraint.
-- Keeps the earliest enrollment per (programId, athleteId).
DELETE FROM "Enrollment"
WHERE id NOT IN (
  SELECT MIN(id) FROM "Enrollment"
  GROUP BY "programId", "athleteId"
);

-- Clean up any existing duplicate AthleteMembership rows before adding constraint.
-- Keeps the earliest membership per (athleteId, membershipInstanceId).
DELETE FROM "AthleteMembership"
WHERE id NOT IN (
  SELECT MIN(id) FROM "AthleteMembership"
  GROUP BY "athleteId", "membershipInstanceId"
);

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_programId_athleteId_key" ON "Enrollment"("programId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteMembership_athleteId_membershipInstanceId_key" ON "AthleteMembership"("athleteId", "membershipInstanceId");

-- AlterTable: add registrationsProcessed flag to Invoice
ALTER TABLE "Invoice" ADD COLUMN "registrationsProcessed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark all PAID invoices as already processed
UPDATE "Invoice" SET "registrationsProcessed" = true WHERE status = 'PAID';
