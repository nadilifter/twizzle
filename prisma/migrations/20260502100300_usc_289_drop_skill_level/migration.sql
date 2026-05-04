-- Backfill levelId from the legacy free-text `level` column by matching
-- against the Level model on (organizationId, name). Only fills rows where
-- levelId is currently null and a unique match exists in the same org.
UPDATE "Skill" s
SET "levelId" = l."id"
FROM "Level" l
WHERE s."levelId" IS NULL
  AND s."level" IS NOT NULL
  AND s."level" <> ''
  AND l."organizationId" = s."organizationId"
  AND l."name" = s."level";

-- AlterTable
ALTER TABLE "Skill" DROP COLUMN "level";
