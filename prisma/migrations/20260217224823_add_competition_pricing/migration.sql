-- CreateEnum
CREATE TYPE "CompetitionPricingMode" AS ENUM ('FREE', 'PER_COMPETITION', 'PER_EVENT', 'TIERED', 'PER_CATEGORY');

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "entryFee" DECIMAL(10,2),
ADD COLUMN     "pricingMode" "CompetitionPricingMode" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "CompetitionCategory" ADD COLUMN     "price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "CompetitionPricingTier" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "minEvents" INTEGER NOT NULL,
    "maxEvents" INTEGER,
    "pricePerEvent" DECIMAL(10,2) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetitionPricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitionPricingTier_competitionId_idx" ON "CompetitionPricingTier"("competitionId");

-- AddForeignKey
ALTER TABLE "CompetitionPricingTier" ADD CONSTRAINT "CompetitionPricingTier_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
