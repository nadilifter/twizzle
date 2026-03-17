-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN "adyenTokenId" TEXT,
ADD COLUMN "shopperReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_adyenTokenId_key" ON "PaymentMethod"("adyenTokenId");

-- CreateIndex
CREATE INDEX "PaymentMethod_adyenTokenId_idx" ON "PaymentMethod"("adyenTokenId");
