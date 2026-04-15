-- CreateEnum
CREATE TYPE "SmsConsentSource" AS ENUM ('SIGNUP_SITE', 'SIGNUP_ORG', 'INVITATION', 'ACCOUNT_SETTINGS');

-- CreateEnum
CREATE TYPE "SmsConsentRevokeSource" AS ENUM ('ACCOUNT_SETTINGS', 'INBOUND_STOP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "smsConsentAt" TIMESTAMP(3),
ADD COLUMN     "smsConsentIp" TEXT,
ADD COLUMN     "smsConsentRevokeSource" "SmsConsentRevokeSource",
ADD COLUMN     "smsConsentSource" "SmsConsentSource",
ADD COLUMN     "smsConsentVersion" TEXT;
