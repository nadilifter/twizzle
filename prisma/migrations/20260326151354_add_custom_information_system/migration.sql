-- CreateEnum
CREATE TYPE "CustomInfoQuestionType" AS ENUM ('VALUE', 'BOOLEAN', 'SIGNATURE', 'SHORT_TEXT', 'LONG_TEXT', 'IMAGE');

-- CreateEnum
CREATE TYPE "CustomInfoScopeType" AS ENUM ('ALL_PROGRAMS', 'ALL_EVENTS', 'ALL_COMPETITIONS', 'ALL_MEMBERSHIPS', 'ALL_PASSES', 'PROGRAM', 'EVENT', 'COMPETITION', 'MEMBERSHIP', 'PASS', 'SEASON');

-- CreateTable
CREATE TABLE "CustomInfoConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "validityDays" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomInfoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomInfoQuestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "description" TEXT,
    "questionType" "CustomInfoQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomInfoQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomInfoQuestionScope" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "scopeType" "CustomInfoScopeType" NOT NULL,
    "targetId" TEXT,

    CONSTRAINT "CustomInfoQuestionScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomInfoResponse" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "responseValue" TEXT,
    "signatureData" TEXT,
    "fileUrl" TEXT,
    "storageKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomInfoResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomInfoConfig_organizationId_key" ON "CustomInfoConfig"("organizationId");

-- CreateIndex
CREATE INDEX "CustomInfoQuestion_organizationId_idx" ON "CustomInfoQuestion"("organizationId");

-- CreateIndex
CREATE INDEX "CustomInfoQuestion_organizationId_isActive_idx" ON "CustomInfoQuestion"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "CustomInfoQuestionScope_questionId_idx" ON "CustomInfoQuestionScope"("questionId");

-- CreateIndex
CREATE INDEX "CustomInfoQuestionScope_scopeType_targetId_idx" ON "CustomInfoQuestionScope"("scopeType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomInfoQuestionScope_questionId_scopeType_targetId_key" ON "CustomInfoQuestionScope"("questionId", "scopeType", "targetId");

-- CreateIndex
CREATE INDEX "CustomInfoResponse_athleteId_organizationId_idx" ON "CustomInfoResponse"("athleteId", "organizationId");

-- CreateIndex
CREATE INDEX "CustomInfoResponse_questionId_idx" ON "CustomInfoResponse"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomInfoResponse_athleteId_organizationId_questionId_key" ON "CustomInfoResponse"("athleteId", "organizationId", "questionId");

-- AddForeignKey
ALTER TABLE "CustomInfoConfig" ADD CONSTRAINT "CustomInfoConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomInfoQuestion" ADD CONSTRAINT "CustomInfoQuestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomInfoQuestionScope" ADD CONSTRAINT "CustomInfoQuestionScope_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CustomInfoQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomInfoResponse" ADD CONSTRAINT "CustomInfoResponse_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomInfoResponse" ADD CONSTRAINT "CustomInfoResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomInfoResponse" ADD CONSTRAINT "CustomInfoResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CustomInfoQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomInfoResponse" ADD CONSTRAINT "CustomInfoResponse_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
