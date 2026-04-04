-- CreateIndex
CREATE INDEX "CustomInfoResponse_organizationId_idx" ON "CustomInfoResponse"("organizationId");

-- CreateIndex
CREATE INDEX "Program_organizationId_idx" ON "Program"("organizationId");

-- CreateIndex
CREATE INDEX "MembershipGroup_organizationId_idx" ON "MembershipGroup"("organizationId");

-- CreateIndex
CREATE INDEX "Event_organizationId_idx" ON "Event"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Discount_organizationId_idx" ON "Discount"("organizationId");

-- CreateIndex
CREATE INDEX "LedgerEntry_organizationId_idx" ON "LedgerEntry"("organizationId");

-- CreateIndex
CREATE INDEX "Skill_organizationId_idx" ON "Skill"("organizationId");

-- CreateIndex
CREATE INDEX "LessonPlan_organizationId_idx" ON "LessonPlan"("organizationId");

-- CreateIndex
CREATE INDEX "SmsNumberAssignment_organizationId_idx" ON "SmsNumberAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "CompetitionTeam_organizationId_idx" ON "CompetitionTeam"("organizationId");
