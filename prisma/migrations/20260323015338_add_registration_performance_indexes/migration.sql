-- CreateIndex
CREATE INDEX "AthleteMembership_athleteId_status_idx" ON "AthleteMembership"("athleteId", "status");

-- CreateIndex
CREATE INDEX "AthleteMembership_athleteId_status_membershipInstanceId_idx" ON "AthleteMembership"("athleteId", "status", "membershipInstanceId");

-- CreateIndex
CREATE INDEX "Enrollment_programId_athleteId_status_idx" ON "Enrollment"("programId", "athleteId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_programId_status_idx" ON "Enrollment"("programId", "status");

-- CreateIndex
CREATE INDEX "InstanceRegistration_programInstanceId_status_idx" ON "InstanceRegistration"("programInstanceId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_queueConfigId_status_enteredAt_idx" ON "QueueEntry"("queueConfigId", "status", "enteredAt");

-- CreateIndex
CREATE INDEX "QueueReservation_status_expiresAt_idx" ON "QueueReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WaiverAcceptance_userId_waiverId_idx" ON "WaiverAcceptance"("userId", "waiverId");
