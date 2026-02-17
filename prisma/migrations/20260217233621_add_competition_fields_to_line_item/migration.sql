-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "competitionCategoryId" TEXT,
ADD COLUMN     "competitionId" TEXT;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_competitionCategoryId_fkey" FOREIGN KEY ("competitionCategoryId") REFERENCES "CompetitionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
