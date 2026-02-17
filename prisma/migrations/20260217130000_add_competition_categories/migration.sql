-- CreateEnum
CREATE TYPE "CategoryTemplateType" AS ENUM ('COMBINATION', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "CategoryAxis" AS ENUM ('ROW', 'COLUMN');

-- CreateTable
CREATE TABLE "CompetitionCategoryTemplate" (
    "id" TEXT NOT NULL,
    "sportId" TEXT,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CategoryTemplateType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "rowAxisLabel" TEXT,
    "columnAxisLabel" TEXT,
    "restrictionAxis" "CategoryAxis",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionCategoryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAxisValue" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "axis" "CategoryAxis" NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "allowedGenders" "GenderDeclaration"[],

    CONSTRAINT "CategoryAxisValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCombinationEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "rowValueId" TEXT NOT NULL,
    "colValueId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,

    CONSTRAINT "CategoryCombinationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryIndividualEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "hasGenderRestriction" BOOLEAN NOT NULL DEFAULT false,
    "hasAgeRestriction" BOOLEAN NOT NULL DEFAULT false,
    "hasCapacityRestriction" BOOLEAN NOT NULL DEFAULT false,
    "allowedGenders" "GenderDeclaration"[],
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "capacity" INTEGER,

    CONSTRAINT "CategoryIndividualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitionCategoryTemplate_sportId_idx" ON "CompetitionCategoryTemplate"("sportId");

-- CreateIndex
CREATE INDEX "CompetitionCategoryTemplate_organizationId_idx" ON "CompetitionCategoryTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "CategoryAxisValue_templateId_idx" ON "CategoryAxisValue"("templateId");

-- CreateIndex
CREATE INDEX "CategoryCombinationEntry_templateId_idx" ON "CategoryCombinationEntry"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryCombinationEntry_templateId_rowValueId_colValueId_key" ON "CategoryCombinationEntry"("templateId", "rowValueId", "colValueId");

-- CreateIndex
CREATE INDEX "CategoryIndividualEntry_templateId_idx" ON "CategoryIndividualEntry"("templateId");

-- AddForeignKey
ALTER TABLE "CompetitionCategoryTemplate" ADD CONSTRAINT "CompetitionCategoryTemplate_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCategoryTemplate" ADD CONSTRAINT "CompetitionCategoryTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAxisValue" ADD CONSTRAINT "CategoryAxisValue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompetitionCategoryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCombinationEntry" ADD CONSTRAINT "CategoryCombinationEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompetitionCategoryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCombinationEntry" ADD CONSTRAINT "CategoryCombinationEntry_rowValueId_fkey" FOREIGN KEY ("rowValueId") REFERENCES "CategoryAxisValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCombinationEntry" ADD CONSTRAINT "CategoryCombinationEntry_colValueId_fkey" FOREIGN KEY ("colValueId") REFERENCES "CategoryAxisValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryIndividualEntry" ADD CONSTRAINT "CategoryIndividualEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompetitionCategoryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OrganizationCategoryPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrganizationCategoryPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationCategoryPreference_organizationId_idx" ON "OrganizationCategoryPreference"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationCategoryPreference_organizationId_templateId_key" ON "OrganizationCategoryPreference"("organizationId", "templateId");

-- AddForeignKey
ALTER TABLE "OrganizationCategoryPreference" ADD CONSTRAINT "OrganizationCategoryPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCategoryPreference" ADD CONSTRAINT "OrganizationCategoryPreference_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompetitionCategoryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
