-- CreateIndex
CREATE INDEX "AccountingConnection_provider_isActive_setupComplete_idx" ON "AccountingConnection"("provider", "isActive", "setupComplete");
