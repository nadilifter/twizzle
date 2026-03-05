-- Add composite index to ProgramInstance for calendar queries
-- The calendar API filters by organizationId + date range on every load
-- Separate indexes exist but the composite is more efficient for this pattern
CREATE INDEX "ProgramInstance_organizationId_date_idx" ON "ProgramInstance"("organizationId", "date");
