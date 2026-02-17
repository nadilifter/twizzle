-- AlterTable: SubscriptionPlan - add featureToggles JSON field
ALTER TABLE "SubscriptionPlan" ADD COLUMN "featureToggles" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: OrganizationFeatureOverride
CREATE TABLE "OrganizationFeatureOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "featureToggles" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationFeatureOverride_organizationId_key" ON "OrganizationFeatureOverride"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationFeatureOverride" ADD CONSTRAINT "OrganizationFeatureOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
