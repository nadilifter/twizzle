-- Add balance field to User model
ALTER TABLE "User" ADD COLUMN "balance" DECIMAL(10,2) NOT NULL DEFAULT 0;
