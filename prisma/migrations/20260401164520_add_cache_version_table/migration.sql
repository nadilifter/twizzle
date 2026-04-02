-- CreateTable
CREATE TABLE "CacheVersion" (
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CacheVersion_pkey" PRIMARY KEY ("organizationId","entityType")
);
