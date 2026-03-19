-- CreateEnum
CREATE TYPE "QboEntityType" AS ENUM ('ACCOUNT', 'CUSTOMER', 'ITEM', 'INVOICE', 'PAYMENT', 'REFUND_RECEIPT', 'JOURNAL_ENTRY', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "QboSyncAction" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "QboSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "QboMappingType" AS ENUM ('GL_CODE', 'BANK_ACCOUNT', 'PROCESSING_FEES', 'REFUNDS', 'UNDEPOSITED_FUNDS');

-- CreateTable
CREATE TABLE "QboConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
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

    CONSTRAINT "QboConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QboAccountMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "mappingType" "QboMappingType" NOT NULL,
    "uplifterEntityId" TEXT,
    "qboAccountId" TEXT NOT NULL,
    "qboAccountName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QboAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QboSyncMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entityType" "QboEntityType" NOT NULL,
    "uplifterEntityId" TEXT NOT NULL,
    "qboEntityId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "checksum" TEXT,

    CONSTRAINT "QboSyncMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QboSyncQueue" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entityType" "QboEntityType" NOT NULL,
    "uplifterEntityId" TEXT NOT NULL,
    "action" "QboSyncAction" NOT NULL,
    "status" "QboSyncStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QboSyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QboSyncLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entityType" "QboEntityType" NOT NULL,
    "uplifterEntityId" TEXT NOT NULL,
    "action" "QboSyncAction" NOT NULL,
    "status" "QboSyncStatus" NOT NULL,
    "qboEntityId" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QboSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QboConnection_organizationId_key" ON "QboConnection"("organizationId");

-- CreateIndex
CREATE INDEX "QboAccountMapping_connectionId_idx" ON "QboAccountMapping"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "QboAccountMapping_connectionId_mappingType_uplifterEntityId_key" ON "QboAccountMapping"("connectionId", "mappingType", "uplifterEntityId");

-- CreateIndex
CREATE INDEX "QboSyncMapping_connectionId_entityType_idx" ON "QboSyncMapping"("connectionId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "QboSyncMapping_connectionId_entityType_uplifterEntityId_key" ON "QboSyncMapping"("connectionId", "entityType", "uplifterEntityId");

-- CreateIndex
CREATE INDEX "QboSyncQueue_connectionId_status_idx" ON "QboSyncQueue"("connectionId", "status");

-- CreateIndex
CREATE INDEX "QboSyncQueue_status_priority_createdAt_idx" ON "QboSyncQueue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "QboSyncLog_connectionId_createdAt_idx" ON "QboSyncLog"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "QboConnection" ADD CONSTRAINT "QboConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QboAccountMapping" ADD CONSTRAINT "QboAccountMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "QboConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QboSyncMapping" ADD CONSTRAINT "QboSyncMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "QboConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QboSyncQueue" ADD CONSTRAINT "QboSyncQueue_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "QboConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QboSyncLog" ADD CONSTRAINT "QboSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "QboConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
