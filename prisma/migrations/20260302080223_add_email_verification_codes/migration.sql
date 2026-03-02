-- CreateEnum
CREATE TYPE "VerificationCodeType" AS ENUM ('MFA_CHALLENGE', 'EMAIL_LOGIN');

-- CreateTable
CREATE TABLE "EmailVerificationCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "VerificationCodeType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationCode_token_key" ON "EmailVerificationCode"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationCode_email_type_idx" ON "EmailVerificationCode"("email", "type");
