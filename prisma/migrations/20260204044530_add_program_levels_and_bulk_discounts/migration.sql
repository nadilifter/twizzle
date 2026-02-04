-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('SINGLE_INSTANCE', 'SUBSCRIPTION', 'DROP_IN');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('FLAT_RATE', 'PER_SESSION');

-- CreateEnum
CREATE TYPE "BulkDiscountType" AS ENUM ('FAMILY_SIBLING', 'MULTI_SESSION');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "basePrice" DECIMAL(10,2),
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "levelId" TEXT,
ADD COLUMN     "perSessionPrice" DECIMAL(10,2),
ADD COLUMN     "pricingModel" "PricingModel" NOT NULL DEFAULT 'FLAT_RATE',
ADD COLUMN     "programType" "ProgramType" NOT NULL DEFAULT 'SUBSCRIPTION',
ADD COLUMN     "schedulePattern" JSONB,
ADD COLUMN     "showCoachOnSite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showLevelOnSite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "levelId" TEXT;

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBulkDiscount" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "type" "BulkDiscountType" NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBulkDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Level_organizationId_idx" ON "Level"("organizationId");

-- CreateIndex
CREATE INDEX "Level_order_idx" ON "Level"("order");

-- CreateIndex
CREATE INDEX "ProgramBulkDiscount_programId_idx" ON "ProgramBulkDiscount"("programId");

-- CreateIndex
CREATE INDEX "Program_levelId_idx" ON "Program"("levelId");

-- CreateIndex
CREATE INDEX "Skill_levelId_idx" ON "Skill"("levelId");

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBulkDiscount" ADD CONSTRAINT "ProgramBulkDiscount_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;
