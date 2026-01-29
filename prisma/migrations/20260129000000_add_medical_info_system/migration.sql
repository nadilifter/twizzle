-- CreateEnum
CREATE TYPE "MedicalQuestionType" AS ENUM ('TEXT', 'YES_NO', 'MULTIPLE_CHOICE', 'CHECKBOX');

-- CreateTable
CREATE TABLE "MedicalFormConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "collectAllergies" BOOLEAN NOT NULL DEFAULT true,
    "collectMedications" BOOLEAN NOT NULL DEFAULT true,
    "collectConditions" BOOLEAN NOT NULL DEFAULT true,
    "collectEmergencyContact" BOOLEAN NOT NULL DEFAULT true,
    "collectDietaryRestrictions" BOOLEAN NOT NULL DEFAULT false,
    "collectInsuranceInfo" BOOLEAN NOT NULL DEFAULT false,
    "requireDuringRegistration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalFormConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomMedicalQuestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "MedicalQuestionType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomMedicalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteMedicalInfo" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "allergies" TEXT[],
    "medications" TEXT[],
    "conditions" TEXT[],
    "dietaryRestrictions" TEXT[],
    "insuranceProvider" TEXT,
    "insurancePolicyNumber" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "additionalNotes" TEXT,
    "lastUpdatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteMedicalInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomMedicalResponse" (
    "id" TEXT NOT NULL,
    "medicalInfoId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomMedicalResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalFormConfig_organizationId_key" ON "MedicalFormConfig"("organizationId");

-- CreateIndex
CREATE INDEX "CustomMedicalQuestion_organizationId_idx" ON "CustomMedicalQuestion"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteMedicalInfo_athleteId_key" ON "AthleteMedicalInfo"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteMedicalInfo_athleteId_idx" ON "AthleteMedicalInfo"("athleteId");

-- CreateIndex
CREATE INDEX "CustomMedicalResponse_medicalInfoId_idx" ON "CustomMedicalResponse"("medicalInfoId");

-- CreateIndex
CREATE INDEX "CustomMedicalResponse_questionId_idx" ON "CustomMedicalResponse"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomMedicalResponse_medicalInfoId_questionId_key" ON "CustomMedicalResponse"("medicalInfoId", "questionId");

-- AddForeignKey
ALTER TABLE "MedicalFormConfig" ADD CONSTRAINT "MedicalFormConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMedicalQuestion" ADD CONSTRAINT "CustomMedicalQuestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMedicalInfo" ADD CONSTRAINT "AthleteMedicalInfo_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMedicalResponse" ADD CONSTRAINT "CustomMedicalResponse_medicalInfoId_fkey" FOREIGN KEY ("medicalInfoId") REFERENCES "AthleteMedicalInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMedicalResponse" ADD CONSTRAINT "CustomMedicalResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CustomMedicalQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
