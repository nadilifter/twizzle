-- Add coachId to SmsConversation for coach-specific conversations
ALTER TABLE "SmsConversation" ADD COLUMN "coachId" TEXT;

-- Foreign key to User
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop existing unique constraint (org + user)
DROP INDEX IF EXISTS "SmsConversation_organizationId_userId_key";

-- Org conversations: one per org+user (existing behavior preserved)
CREATE UNIQUE INDEX "SmsConversation_org_user_unique"
  ON "SmsConversation" ("organizationId", "userId")
  WHERE "coachId" IS NULL;

-- Coach conversations: one per user+coach (org-agnostic uniqueness)
CREATE UNIQUE INDEX "SmsConversation_user_coach_unique"
  ON "SmsConversation" ("userId", "coachId")
  WHERE "coachId" IS NOT NULL;

-- Index for querying coach conversations by org
CREATE INDEX "SmsConversation_organizationId_coachId_idx"
  ON "SmsConversation" ("organizationId", "coachId");
