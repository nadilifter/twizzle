-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "level",
ADD COLUMN     "levelId" TEXT;

-- AlterTable
ALTER TABLE "EvaluationTemplate" DROP COLUMN "difficultyLevel",
ADD COLUMN     "levelId" TEXT;

-- AlterTable
ALTER TABLE "Skill" DROP COLUMN "difficultyLevel";

-- DropEnum
DROP TYPE "SkillDifficulty";

-- CreateIndex
CREATE INDEX "Evaluation_levelId_idx" ON "Evaluation"("levelId");

-- CreateIndex
CREATE INDEX "EvaluationTemplate_levelId_idx" ON "EvaluationTemplate"("levelId");

-- AddForeignKey
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;
