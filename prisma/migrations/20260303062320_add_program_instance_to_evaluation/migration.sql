-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "programInstanceId" TEXT;

-- CreateIndex
CREATE INDEX "Evaluation_programInstanceId_idx" ON "Evaluation"("programInstanceId");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_programInstanceId_fkey" FOREIGN KEY ("programInstanceId") REFERENCES "ProgramInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
