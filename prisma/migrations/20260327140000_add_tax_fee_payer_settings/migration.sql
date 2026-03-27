-- CreateEnum
CREATE TYPE "FeePayer" AS ENUM ('CUSTOMER', 'ORGANIZATION');

-- AlterTable: Organization
ALTER TABLE "Organization" ADD COLUMN "taxPaidBy" "FeePayer" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Organization" ADD COLUMN "processingFeePaidBy" "FeePayer" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable: Invoice
ALTER TABLE "Invoice" ADD COLUMN "processingFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
