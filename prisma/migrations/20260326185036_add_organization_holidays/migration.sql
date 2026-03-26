-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NATIONAL', 'CUSTOM');

-- CreateTable
CREATE TABLE "OrganizationHoliday" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "year" INTEGER NOT NULL,
    "countryCode" TEXT,
    "stateCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationHoliday_organizationId_year_idx" ON "OrganizationHoliday"("organizationId", "year");

-- CreateIndex
CREATE INDEX "OrganizationHoliday_organizationId_date_idx" ON "OrganizationHoliday"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationHoliday_organizationId_date_name_key" ON "OrganizationHoliday"("organizationId", "date", "name");

-- AddForeignKey
ALTER TABLE "OrganizationHoliday" ADD CONSTRAINT "OrganizationHoliday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
