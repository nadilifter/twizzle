-- CreateEnum
CREATE TYPE "SkillDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "SkillAttemptStatus" AS ENUM ('NOT_ATTEMPTED', 'ATTEMPTED', 'SUCCEEDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvaluationStatus" ADD VALUE 'PENDING';
ALTER TYPE "EvaluationStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "EvaluationSkill" ADD COLUMN     "attemptStatus" "SkillAttemptStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
ALTER COLUMN "rating" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "difficultyLevel" "SkillDifficulty" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "maxAge" INTEGER,
ADD COLUMN     "minAge" INTEGER,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "EvaluationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "difficultyLevel" "SkillDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationTemplateSkill" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationTemplateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteSkillProgress" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "bestStatus" "SkillAttemptStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "firstAttemptedAt" TIMESTAMP(3),
    "firstSucceededAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL,
    "lastEvaluationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteSkillProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationTemplate_organizationId_idx" ON "EvaluationTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "EvaluationTemplateSkill_templateId_idx" ON "EvaluationTemplateSkill"("templateId");

-- CreateIndex
CREATE INDEX "EvaluationTemplateSkill_skillId_idx" ON "EvaluationTemplateSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationTemplateSkill_templateId_skillId_key" ON "EvaluationTemplateSkill"("templateId", "skillId");

-- CreateIndex
CREATE INDEX "AthleteSkillProgress_athleteId_idx" ON "AthleteSkillProgress"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteSkillProgress_skillId_idx" ON "AthleteSkillProgress"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteSkillProgress_athleteId_skillId_key" ON "AthleteSkillProgress"("athleteId", "skillId");

-- CreateIndex
CREATE INDEX "Evaluation_athleteId_idx" ON "Evaluation"("athleteId");

-- CreateIndex
CREATE INDEX "Evaluation_coachId_idx" ON "Evaluation"("coachId");

-- CreateIndex
CREATE INDEX "Evaluation_templateId_idx" ON "Evaluation"("templateId");

-- CreateIndex
CREATE INDEX "EvaluationSkill_evaluationId_idx" ON "EvaluationSkill"("evaluationId");

-- CreateIndex
CREATE INDEX "EvaluationSkill_skillId_idx" ON "EvaluationSkill"("skillId");

-- AddForeignKey
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationTemplateSkill" ADD CONSTRAINT "EvaluationTemplateSkill_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationTemplateSkill" ADD CONSTRAINT "EvaluationTemplateSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteSkillProgress" ADD CONSTRAINT "AthleteSkillProgress_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteSkillProgress" ADD CONSTRAINT "AthleteSkillProgress_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
