-- CreateTable
CREATE TABLE "AthleteMerge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "duplicateId" TEXT NOT NULL,
    "duplicateSnapshot" JSONB NOT NULL,
    "counts" JSONB NOT NULL,
    "mergedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteMerge_organizationId_createdAt_idx" ON "AthleteMerge"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AthleteMerge_survivorId_idx" ON "AthleteMerge"("survivorId");

-- AddForeignKey
ALTER TABLE "AthleteMerge" ADD CONSTRAINT "AthleteMerge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMerge" ADD CONSTRAINT "AthleteMerge_survivorId_fkey" FOREIGN KEY ("survivorId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMerge" ADD CONSTRAINT "AthleteMerge_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
