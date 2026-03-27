-- CreateEnum: ConversationChannel
CREATE TYPE "ConversationChannel" AS ENUM ('WEB_ONLY', 'WEB_SMS', 'WEB_EMAIL');

-- CreateEnum: MessageChannel
CREATE TYPE "MessageChannel" AS ENUM ('WEB', 'SMS', 'EMAIL');

-- RenameEnum: SmsStatus -> MessageStatus
ALTER TYPE "SmsStatus" RENAME TO "MessageStatus";

-- RenameEnum: SmsDirection -> MessageDirection
ALTER TYPE "SmsDirection" RENAME TO "MessageDirection";

-- RenameEnum: SmsClassification -> MessageClassification
ALTER TYPE "SmsClassification" RENAME TO "MessageClassification";

-- RenameEnum: SmsConversationStatus -> ConversationStatus
ALTER TYPE "SmsConversationStatus" RENAME TO "ConversationStatus";

-- Add channel column to SmsConversation (keeping table name via @@map)
ALTER TABLE "SmsConversation" ADD COLUMN "channel" "ConversationChannel" NOT NULL DEFAULT 'WEB_SMS';

-- Add email column to SmsConversation
ALTER TABLE "SmsConversation" ADD COLUMN "email" TEXT;

-- Make phoneNumber optional (default empty string for non-SMS conversations)
ALTER TABLE "SmsConversation" ALTER COLUMN "phoneNumber" SET DEFAULT '';

-- Add channel column to SmsMessage (keeping table name via @@map)
ALTER TABLE "SmsMessage" ADD COLUMN "channel" "MessageChannel" NOT NULL DEFAULT 'SMS';

-- Add email-specific fields to SmsMessage
ALTER TABLE "SmsMessage" ADD COLUMN "sesMessageId" TEXT;
ALTER TABLE "SmsMessage" ADD COLUMN "emailSubject" TEXT;
ALTER TABLE "SmsMessage" ADD COLUMN "htmlBody" TEXT;

-- Make to/from default to empty string for web-only messages
ALTER TABLE "SmsMessage" ALTER COLUMN "to" SET DEFAULT '';
ALTER TABLE "SmsMessage" ALTER COLUMN "from" SET DEFAULT '';

-- Create unique index on sesMessageId
CREATE UNIQUE INDEX "SmsMessage_sesMessageId_key" ON "SmsMessage"("sesMessageId");

-- Backfill: all existing conversations are WEB_SMS, all existing messages are SMS
-- (defaults already handle this for new rows, but explicit for clarity)
UPDATE "SmsConversation" SET "channel" = 'WEB_SMS' WHERE "channel" IS NULL;
UPDATE "SmsMessage" SET "channel" = 'SMS' WHERE "channel" IS NULL;
