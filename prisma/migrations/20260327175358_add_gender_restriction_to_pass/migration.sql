-- AlterTable
ALTER TABLE "Pass" ADD COLUMN     "allowedGenders" "GenderDeclaration"[],
ADD COLUMN     "hasGenderRestriction" BOOLEAN NOT NULL DEFAULT false;
