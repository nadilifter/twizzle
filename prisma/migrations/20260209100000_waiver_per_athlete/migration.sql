-- AlterTable: Add athleteId to WaiverSignature
ALTER TABLE "WaiverSignature" ADD COLUMN "athleteId" TEXT;

-- AlterTable: Add athleteId to WaiverAcceptance
ALTER TABLE "WaiverAcceptance" ADD COLUMN "athleteId" TEXT;

-- Drop old unique indexes
DROP INDEX "WaiverSignature_waiverPageId_familyId_key";
DROP INDEX "WaiverAcceptance_waiverId_familyId_key";

-- Add new unique indexes (per-athlete)
CREATE UNIQUE INDEX "WaiverSignature_waiverPageId_familyId_athleteId_key" ON "WaiverSignature"("waiverPageId", "familyId", "athleteId");
CREATE UNIQUE INDEX "WaiverAcceptance_waiverId_familyId_athleteId_key" ON "WaiverAcceptance"("waiverId", "familyId", "athleteId");

-- Add indexes
CREATE INDEX "WaiverSignature_athleteId_idx" ON "WaiverSignature"("athleteId");
CREATE INDEX "WaiverAcceptance_athleteId_idx" ON "WaiverAcceptance"("athleteId");

-- Add foreign keys
ALTER TABLE "WaiverSignature" ADD CONSTRAINT "WaiverSignature_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
