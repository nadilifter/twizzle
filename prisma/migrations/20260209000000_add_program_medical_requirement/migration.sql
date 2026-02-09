-- AlterTable: Add hasMedicalRequirement to Program
ALTER TABLE "Program" ADD COLUMN "hasMedicalRequirement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Remove requireDuringRegistration from MedicalFormConfig
ALTER TABLE "MedicalFormConfig" DROP COLUMN "requireDuringRegistration";
