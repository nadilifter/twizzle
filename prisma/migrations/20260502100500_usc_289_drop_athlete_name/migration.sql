-- Defensive backfill: any Athlete row that still has only the legacy `name`
-- populated (firstName empty, name non-empty) gets split into firstName/lastName
-- before the column drops. firstName takes the first whitespace-delimited token;
-- lastName takes the rest. Pre-customer staging is expected to have zero rows
-- needing this — every row already carries firstName/lastName from prior writes.
UPDATE "Athlete"
SET
    "firstName" = split_part("name", ' ', 1),
    "lastName" = COALESCE(
        NULLIF(substring("name" FROM position(' ' IN "name") + 1), ''),
        ''
    )
WHERE
    "firstName" = ''
    AND "name" IS NOT NULL
    AND "name" <> '';

-- AlterTable
ALTER TABLE "Athlete" DROP COLUMN "name";
