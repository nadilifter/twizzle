-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "taxEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxRate" DECIMAL(5,4);
