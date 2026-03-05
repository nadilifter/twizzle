-- Add missing indexes to Enrollment model
-- These are used by the enrollment analytics queries which filter by status and createdAt
CREATE INDEX "Enrollment_athleteId_idx" ON "Enrollment"("athleteId");
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");
CREATE INDEX "Enrollment_createdAt_idx" ON "Enrollment"("createdAt");
CREATE INDEX "Enrollment_athleteId_status_idx" ON "Enrollment"("athleteId", "status");
CREATE INDEX "Enrollment_athleteId_createdAt_idx" ON "Enrollment"("athleteId", "createdAt");

-- Add missing indexes to Announcement model
-- Notifications route queries by organizationId + status + publishedAt
CREATE INDEX "Announcement_organizationId_idx" ON "Announcement"("organizationId");
CREATE INDEX "Announcement_organizationId_status_idx" ON "Announcement"("organizationId", "status");
CREATE INDEX "Announcement_status_publishedAt_idx" ON "Announcement"("status", "publishedAt");

-- Add missing indexes to SystemAnnouncement model
-- Queries filter by status and publishedAt on every notifications poll
CREATE INDEX "SystemAnnouncement_status_idx" ON "SystemAnnouncement"("status");
CREATE INDEX "SystemAnnouncement_status_publishedAt_idx" ON "SystemAnnouncement"("status", "publishedAt");
