-- AlterEnum
ALTER TYPE "VerificationCodeType" ADD VALUE 'PHONE_VERIFICATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
