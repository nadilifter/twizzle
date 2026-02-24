-- CreateTable
CREATE TABLE "OrganizationAthlete" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAthlete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationAthlete_organizationId_idx" ON "OrganizationAthlete"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationAthlete_athleteId_idx" ON "OrganizationAthlete"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAthlete_organizationId_athleteId_key" ON "OrganizationAthlete"("organizationId", "athleteId");

-- AddForeignKey
ALTER TABLE "OrganizationAthlete" ADD CONSTRAINT "OrganizationAthlete_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAthlete" ADD CONSTRAINT "OrganizationAthlete_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create OrganizationAthlete records from existing Athlete.organizationId
INSERT INTO "OrganizationAthlete" ("id", "organizationId", "athleteId", "createdAt")
SELECT gen_random_uuid(), "organizationId", "id", "createdAt"
FROM "Athlete"
WHERE "organizationId" IS NOT NULL
ON CONFLICT ("organizationId", "athleteId") DO NOTHING;
