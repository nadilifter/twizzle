-- AlterTable: Transaction - snapshot plan fee rates at time of charge
ALTER TABLE "Transaction" ADD COLUMN "feeRate" DECIMAL(5,4);
ALTER TABLE "Transaction" ADD COLUMN "feeFixed" DECIMAL(10,2);
