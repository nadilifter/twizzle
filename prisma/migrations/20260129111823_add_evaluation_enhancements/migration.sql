-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('PASS_FAIL', 'POINT_SCALE');

-- CreateEnum
CREATE TYPE "CompletionType" AS ENUM ('PERCENTAGE', 'COUNT', 'ALL');

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "programId" TEXT;

-- AlterTable
ALTER TABLE "EvaluationSkill" ADD COLUMN     "passed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pointScore" INTEGER;

-- AlterTable
ALTER TABLE "EvaluationTemplate" ADD COLUMN     "autoSyncCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoSyncLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "completionThreshold" DECIMAL(5,2) NOT NULL DEFAULT 80,
ADD COLUMN     "completionType" "CompletionType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "pointScaleMax" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "pointScaleMin" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pointScalePassThreshold" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "scoringType" "ScoringType" NOT NULL DEFAULT 'PASS_FAIL';

-- CreateTable
CREATE TABLE "ProgramEvaluationTemplate" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramEvaluationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "badgeImageUrl" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteAchievement" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "evaluationId" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestResultsByCategory" JSONB,
    "overallScore" DECIMAL(5,2),

    CONSTRAINT "AthleteAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramEvaluationTemplate_programId_idx" ON "ProgramEvaluationTemplate"("programId");

-- CreateIndex
CREATE INDEX "ProgramEvaluationTemplate_templateId_idx" ON "ProgramEvaluationTemplate"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramEvaluationTemplate_programId_templateId_key" ON "ProgramEvaluationTemplate"("programId", "templateId");

-- CreateIndex
CREATE INDEX "Achievement_templateId_idx" ON "Achievement"("templateId");

-- CreateIndex
CREATE INDEX "Achievement_organizationId_idx" ON "Achievement"("organizationId");

-- CreateIndex
CREATE INDEX "AthleteAchievement_athleteId_idx" ON "AthleteAchievement"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteAchievement_achievementId_idx" ON "AthleteAchievement"("achievementId");

-- CreateIndex
CREATE INDEX "AthleteAchievement_evaluationId_idx" ON "AthleteAchievement"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteAchievement_athleteId_achievementId_key" ON "AthleteAchievement"("athleteId", "achievementId");

-- CreateIndex
CREATE INDEX "Evaluation_programId_idx" ON "Evaluation"("programId");

-- AddForeignKey
ALTER TABLE "ProgramEvaluationTemplate" ADD CONSTRAINT "ProgramEvaluationTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEvaluationTemplate" ADD CONSTRAINT "ProgramEvaluationTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteAchievement" ADD CONSTRAINT "AthleteAchievement_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteAchievement" ADD CONSTRAINT "AthleteAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteAchievement" ADD CONSTRAINT "AthleteAchievement_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
