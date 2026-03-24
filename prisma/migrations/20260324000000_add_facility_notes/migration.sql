-- CreateTable
CREATE TABLE "FacilityNote" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityNote_facilityId_idx" ON "FacilityNote"("facilityId");

-- AddForeignKey
ALTER TABLE "FacilityNote" ADD CONSTRAINT "FacilityNote_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityNote" ADD CONSTRAINT "FacilityNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
