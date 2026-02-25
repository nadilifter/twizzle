-- AlterTable
ALTER TABLE "EmailCampaign" ALTER COLUMN "targetUserIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedBy" TEXT,
ADD COLUMN     "deactivationNotes" TEXT,
ADD COLUMN     "deactivationReason" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "OrganizationAthlete" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SmsCampaign" ALTER COLUMN "targetUserIds" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OrganizationStatusLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationStatusLog_organizationId_idx" ON "OrganizationStatusLog"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationStatusLog" ADD CONSTRAINT "OrganizationStatusLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStatusLog" ADD CONSTRAINT "OrganizationStatusLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
