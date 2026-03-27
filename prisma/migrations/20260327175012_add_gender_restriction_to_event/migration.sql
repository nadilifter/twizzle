-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "allowedGenders" "GenderDeclaration"[],
ADD COLUMN     "hasGenderRestriction" BOOLEAN NOT NULL DEFAULT false;
