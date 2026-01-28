-- AlterTable
ALTER TABLE "SmsMessage" ADD COLUMN     "conversationId" TEXT;

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "smsOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SmsConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "familyId" TEXT,
    "staffProfileId" TEXT,
    "displayName" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "lastDirection" "SmsDirection" NOT NULL,
    "lastMessagePreview" VARCHAR(160),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "canReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsConversation_organizationId_lastMessageAt_idx" ON "SmsConversation"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SmsConversation_familyId_idx" ON "SmsConversation"("familyId");

-- CreateIndex
CREATE INDEX "SmsConversation_staffProfileId_idx" ON "SmsConversation"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsConversation_organizationId_phoneNumber_key" ON "SmsConversation"("organizationId", "phoneNumber");

-- CreateIndex
CREATE INDEX "SmsMessage_staffProfileId_idx" ON "SmsMessage"("staffProfileId");

-- CreateIndex
CREATE INDEX "SmsMessage_conversationId_idx" ON "SmsMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SmsConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsConversation" ADD CONSTRAINT "SmsConversation_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
