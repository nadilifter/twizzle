-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_organizationId_idx" ON "Category"("organizationId");

-- CreateIndex
CREATE INDEX "Competition_categoryId_idx" ON "Competition"("categoryId");

-- CreateIndex
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");

-- CreateIndex
CREATE INDEX "Program_categoryId_idx" ON "Program"("categoryId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
