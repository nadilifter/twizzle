/*
  Warnings:

  - You are about to drop the `QboAccountMapping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QboConnection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QboSyncLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QboSyncMapping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QboSyncQueue` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AccountingProvider" AS ENUM ('QBO', 'XERO');

-- CreateEnum
CREATE TYPE "AccountingEntityType" AS ENUM ('ACCOUNT', 'CUSTOMER', 'ITEM', 'INVOICE', 'PAYMENT', 'REFUND', 'JOURNAL_ENTRY', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "AccountingSyncAction" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "AccountingSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AccountingMappingType" AS ENUM ('GL_CODE', 'BANK_ACCOUNT', 'PROCESSING_FEES', 'REFUNDS', 'UNDEPOSITED_FUNDS');

-- DropForeignKey
ALTER TABLE "QboAccountMapping" DROP CONSTRAINT "QboAccountMapping_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "QboConnection" DROP CONSTRAINT "QboConnection_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "QboSyncLog" DROP CONSTRAINT "QboSyncLog_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "QboSyncMapping" DROP CONSTRAINT "QboSyncMapping_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "QboSyncQueue" DROP CONSTRAINT "QboSyncQueue_connectionId_fkey";

-- DropTable
DROP TABLE "QboAccountMapping";

-- DropTable
DROP TABLE "QboConnection";

-- DropTable
DROP TABLE "QboSyncLog";

-- DropTable
DROP TABLE "QboSyncMapping";

-- DropTable
DROP TABLE "QboSyncQueue";

-- DropEnum
DROP TYPE "QboEntityType";

-- DropEnum
DROP TYPE "QboMappingType";

-- DropEnum
DROP TYPE "QboSyncAction";

-- DropEnum
DROP TYPE "QboSyncStatus";

-- CreateTable
CREATE TABLE "AccountingConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "AccountingProvider" NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "companyName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "setupComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingAccountMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "mappingType" "AccountingMappingType" NOT NULL,
    "uplifterEntityId" TEXT,
    "externalAccountId" TEXT NOT NULL,
    "externalAccountName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingSyncMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entityType" "AccountingEntityType" NOT NULL,
    "uplifterEntityId" TEXT NOT NULL,
    "externalEntityId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "checksum" TEXT,

    CONSTRAINT "AccountingSyncMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingSyncQueue" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entityType" "AccountingEntityType" NOT NULL,
    "uplifterEntityId" TEXT NOT NULL,
    "action" "AccountingSyncAction" NOT NULL,
    "status" "AccountingSyncStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingSyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingSyncLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entityType" "AccountingEntityType" NOT NULL,
    "uplifterEntityId" TEXT NOT NULL,
    "action" "AccountingSyncAction" NOT NULL,
    "status" "AccountingSyncStatus" NOT NULL,
    "externalEntityId" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingConnection_organizationId_provider_key" ON "AccountingConnection"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "AccountingAccountMapping_connectionId_idx" ON "AccountingAccountMapping"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingAccountMapping_connectionId_mappingType_uplifterE_key" ON "AccountingAccountMapping"("connectionId", "mappingType", "uplifterEntityId");

-- CreateIndex
CREATE INDEX "AccountingSyncMapping_connectionId_entityType_idx" ON "AccountingSyncMapping"("connectionId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingSyncMapping_connectionId_entityType_uplifterEntit_key" ON "AccountingSyncMapping"("connectionId", "entityType", "uplifterEntityId");

-- CreateIndex
CREATE INDEX "AccountingSyncQueue_connectionId_status_idx" ON "AccountingSyncQueue"("connectionId", "status");

-- CreateIndex
CREATE INDEX "AccountingSyncQueue_status_priority_createdAt_idx" ON "AccountingSyncQueue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "AccountingSyncLog_connectionId_createdAt_idx" ON "AccountingSyncLog"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccountingConnection" ADD CONSTRAINT "AccountingConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingAccountMapping" ADD CONSTRAINT "AccountingAccountMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AccountingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingSyncMapping" ADD CONSTRAINT "AccountingSyncMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AccountingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingSyncQueue" ADD CONSTRAINT "AccountingSyncQueue_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AccountingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingSyncLog" ADD CONSTRAINT "AccountingSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AccountingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
