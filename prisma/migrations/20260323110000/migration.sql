-- CreateIndex
CREATE INDEX "Order_organizationId_fulfillmentStatus_createdAt_idx" ON "Order"("organizationId", "fulfillmentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Order_organizationId_source_idx" ON "Order"("organizationId", "source");

-- CreateIndex
CREATE INDEX "StockMovement_referenceId_type_idx" ON "StockMovement"("referenceId", "type");
