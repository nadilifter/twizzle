-- CreateEnum
CREATE TYPE "GenderDeclaration" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" "GenderDeclaration",
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '';

-- Backfill: split existing "name" into firstName and lastName
UPDATE "Athlete"
SET
  "firstName" = CASE
    WHEN POSITION(' ' IN "name") > 0 THEN LEFT("name", POSITION(' ' IN "name") - 1)
    ELSE "name"
  END,
  "lastName" = CASE
    WHEN POSITION(' ' IN "name") > 0 THEN SUBSTRING("name" FROM POSITION(' ' IN "name") + 1)
    ELSE ''
  END
WHERE "firstName" = '' OR "lastName" = '';
