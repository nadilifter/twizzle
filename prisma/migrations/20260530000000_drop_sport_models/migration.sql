-- Drop sport-specific FK columns from CompetitionCategory
ALTER TABLE "CompetitionCategory" DROP COLUMN IF EXISTS "sportEventId";
ALTER TABLE "CompetitionCategory" DROP COLUMN IF EXISTS "ageCategoryId";

-- Drop sport FK column from CompetitionCategoryTemplate
ALTER TABLE "CompetitionCategoryTemplate" DROP COLUMN IF EXISTS "sportId";

-- Drop the 5 sport tables (CASCADE handles FK refs)
DROP TABLE IF EXISTS "SportEventEligibility" CASCADE;
DROP TABLE IF EXISTS "SportEvent" CASCADE;
DROP TABLE IF EXISTS "SportAgeCategory" CASCADE;
DROP TABLE IF EXISTS "OrganizationSport" CASCADE;
DROP TABLE IF EXISTS "Sport" CASCADE;
