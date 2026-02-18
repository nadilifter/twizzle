-- AlterEnum: Add PLACEMENT to ResultType
ALTER TYPE "ResultType" ADD VALUE 'PLACEMENT';

-- AlterTable: Add structured seed mark columns to CompetitionEntry
ALTER TABLE "CompetitionEntry"
    ADD COLUMN "seedHours" INTEGER,
    ADD COLUMN "seedMinutes" INTEGER,
    ADD COLUMN "seedSeconds" INTEGER,
    ADD COLUMN "seedMs" INTEGER,
    ADD COLUMN "seedHandTimed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "seedDistance" DECIMAL(8,2),
    ADD COLUMN "seedPoints" DECIMAL(10,3),
    ADD COLUMN "seedPlacement" TEXT;

-- Migrate existing seed mark data before dropping the column
-- TIME entries: seedMark stored as total milliseconds -> decompose into h/m/s/ms
UPDATE "CompetitionEntry" e
SET
    "seedHours"   = FLOOR(e."seedMark" / 3600000)::INTEGER,
    "seedMinutes" = FLOOR((e."seedMark" % 3600000) / 60000)::INTEGER,
    "seedSeconds" = FLOOR((e."seedMark" % 60000) / 1000)::INTEGER,
    "seedMs"      = (e."seedMark" % 1000)::INTEGER
FROM "CompetitionCategory" c
WHERE e."competitionCategoryId" = c."id"
  AND c."resultType" = 'TIME'
  AND e."seedMark" IS NOT NULL;

-- DISTANCE/HEIGHT entries: seedMark stored as millimetres -> convert to metres
UPDATE "CompetitionEntry" e
SET "seedDistance" = e."seedMark" / 1000.0
FROM "CompetitionCategory" c
WHERE e."competitionCategoryId" = c."id"
  AND c."resultType" IN ('DISTANCE', 'HEIGHT')
  AND e."seedMark" IS NOT NULL;

-- SCORE entries: copy seedMark directly to seedPoints
UPDATE "CompetitionEntry" e
SET "seedPoints" = e."seedMark"
FROM "CompetitionCategory" c
WHERE e."competitionCategoryId" = c."id"
  AND c."resultType" = 'SCORE'
  AND e."seedMark" IS NOT NULL;

-- Drop the old seedMark column
ALTER TABLE "CompetitionEntry" DROP COLUMN "seedMark";

-- AlterTable: Add heat and isHandTimed to CompetitionResult
ALTER TABLE "CompetitionResult"
    ADD COLUMN "heat" INTEGER,
    ADD COLUMN "isHandTimed" BOOLEAN NOT NULL DEFAULT false;
