-- CreateTable
CREATE TABLE "FacilityOperatingHours" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,

    CONSTRAINT "FacilityOperatingHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityOperatingHours_facilityId_idx" ON "FacilityOperatingHours"("facilityId");

-- AddForeignKey
ALTER TABLE "FacilityOperatingHours" ADD CONSTRAINT "FacilityOperatingHours_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
