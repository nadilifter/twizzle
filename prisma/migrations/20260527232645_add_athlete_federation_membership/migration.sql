-- AlterTable
ALTER TABLE "OrganizationAthlete" ADD COLUMN     "federationMemberExpiresAt" TIMESTAMP(3),
ADD COLUMN     "federationMemberNumber" TEXT,
ADD COLUMN     "federationName" TEXT;

-- CreateIndex
CREATE INDEX "OrganizationAthlete_federationMemberNumber_idx" ON "OrganizationAthlete"("federationMemberNumber");
