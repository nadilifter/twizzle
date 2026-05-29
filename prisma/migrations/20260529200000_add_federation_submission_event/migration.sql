-- CreateEnum
CREATE TYPE "FederationSubmissionEventType" AS ENUM ('CREATED', 'PAYLOAD_UPDATED', 'ATHLETE_ADDED', 'ATHLETE_REMOVED', 'STATUS_TRANSITIONED', 'EXTERNAL_REF_SET', 'RESOLUTION_NOTE_SET', 'NOTE_ADDED');

-- CreateTable
CREATE TABLE "FederationSubmissionEvent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "eventType" "FederationSubmissionEventType" NOT NULL,
    "data" JSONB,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederationSubmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FederationSubmissionEvent_submissionId_createdAt_idx" ON "FederationSubmissionEvent"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "FederationSubmissionEvent_eventType_idx" ON "FederationSubmissionEvent"("eventType");

-- AddForeignKey
ALTER TABLE "FederationSubmissionEvent" ADD CONSTRAINT "FederationSubmissionEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FederationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationSubmissionEvent" ADD CONSTRAINT "FederationSubmissionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
