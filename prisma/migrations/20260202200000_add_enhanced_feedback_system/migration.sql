-- AlterEnum: Add new values and remove OPEN
-- First, update existing OPEN values to SUBMITTED
UPDATE "FeatureRequest" SET "status" = 'IN_PROGRESS' WHERE "status" = 'OPEN';

-- Create new enum type
CREATE TYPE "FeatureStatus_new" AS ENUM ('SUBMITTED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CLOSED');

-- Alter the column to use the new enum
ALTER TABLE "FeatureRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "FeatureRequest" ALTER COLUMN "status" TYPE "FeatureStatus_new" USING ("status"::text::"FeatureStatus_new");

-- Drop old enum and rename new one
DROP TYPE "FeatureStatus";
ALTER TYPE "FeatureStatus_new" RENAME TO "FeatureStatus";

-- Set new default
ALTER TABLE "FeatureRequest" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

-- Add new columns to FeatureRequest
ALTER TABLE "FeatureRequest" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FeatureRequest" ADD COLUMN "targetDate" TIMESTAMP(3);
ALTER TABLE "FeatureRequest" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "FeatureRequest" ADD COLUMN "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FeatureRequest" ADD COLUMN "mergedIntoId" TEXT;

-- Remove votes column (will be calculated from FeatureVote)
ALTER TABLE "FeatureRequest" DROP COLUMN "votes";

-- Add isStaffReply to FeatureComment
ALTER TABLE "FeatureComment" ADD COLUMN "isStaffReply" BOOLEAN NOT NULL DEFAULT false;

-- Create FeatureVote table
CREATE TABLE "FeatureVote" (
    "id" TEXT NOT NULL,
    "featureRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureVote_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "FeatureRequest_status_idx" ON "FeatureRequest"("status");
CREATE INDEX "FeatureRequest_isPublic_idx" ON "FeatureRequest"("isPublic");
CREATE INDEX "FeatureRequest_userId_idx" ON "FeatureRequest"("userId");
CREATE INDEX "FeatureVote_featureRequestId_idx" ON "FeatureVote"("featureRequestId");
CREATE INDEX "FeatureVote_userId_idx" ON "FeatureVote"("userId");
CREATE INDEX "FeatureComment_featureRequestId_idx" ON "FeatureComment"("featureRequestId");
CREATE INDEX "FeatureComment_userId_idx" ON "FeatureComment"("userId");

-- Create unique constraint for one vote per user per feature
CREATE UNIQUE INDEX "FeatureVote_featureRequestId_userId_key" ON "FeatureVote"("featureRequestId", "userId");

-- Add foreign keys
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "FeatureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeatureVote" ADD CONSTRAINT "FeatureVote_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "FeatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureVote" ADD CONSTRAINT "FeatureVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureComment" ADD CONSTRAINT "FeatureComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
