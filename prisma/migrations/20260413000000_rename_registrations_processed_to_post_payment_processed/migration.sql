-- Rename registrationsProcessed to postPaymentProcessed on Invoice
-- This field is a general "all post-payment work is done" flag (registrations,
-- inventory, etc.) and the old name was misleading for non-registration checkouts.
ALTER TABLE "Invoice" RENAME COLUMN "registrationsProcessed" TO "postPaymentProcessed";
