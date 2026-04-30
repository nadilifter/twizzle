-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "bulkDiscountId" TEXT;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_bulkDiscountId_fkey" FOREIGN KEY ("bulkDiscountId") REFERENCES "ProgramBulkDiscount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
