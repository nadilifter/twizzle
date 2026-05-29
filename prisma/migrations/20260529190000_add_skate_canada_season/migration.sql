-- CreateTable
CREATE TABLE "SkateCanadaSeason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "scSeasonGuid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkateCanadaSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkateCanadaSeason_name_key" ON "SkateCanadaSeason"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SkateCanadaSeason_scSeasonGuid_key" ON "SkateCanadaSeason"("scSeasonGuid");

-- CreateIndex
CREATE INDEX "SkateCanadaSeason_isActive_idx" ON "SkateCanadaSeason"("isActive");

-- CreateIndex
CREATE INDEX "SkateCanadaSeason_startDate_endDate_idx" ON "SkateCanadaSeason"("startDate", "endDate");

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "skateCanadaSeasonId" TEXT;

-- AlterTable
ALTER TABLE "MembershipGroup" ADD COLUMN     "skateCanadaSeasonId" TEXT;

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "skateCanadaSeasonId" TEXT;

-- CreateIndex
CREATE INDEX "Program_skateCanadaSeasonId_idx" ON "Program"("skateCanadaSeasonId");

-- CreateIndex
CREATE INDEX "MembershipGroup_skateCanadaSeasonId_idx" ON "MembershipGroup"("skateCanadaSeasonId");

-- CreateIndex
CREATE INDEX "Competition_skateCanadaSeasonId_idx" ON "Competition"("skateCanadaSeasonId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_skateCanadaSeasonId_fkey" FOREIGN KEY ("skateCanadaSeasonId") REFERENCES "SkateCanadaSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipGroup" ADD CONSTRAINT "MembershipGroup_skateCanadaSeasonId_fkey" FOREIGN KEY ("skateCanadaSeasonId") REFERENCES "SkateCanadaSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_skateCanadaSeasonId_fkey" FOREIGN KEY ("skateCanadaSeasonId") REFERENCES "SkateCanadaSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
