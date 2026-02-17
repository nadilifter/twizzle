-- AlterEnum
-- This must be in its own migration because PostgreSQL requires new enum values
-- to be committed before they can be referenced in DEFAULT clauses or queries.
ALTER TYPE "BillingInterval" ADD VALUE IF NOT EXISTS 'ONE_TIME';
