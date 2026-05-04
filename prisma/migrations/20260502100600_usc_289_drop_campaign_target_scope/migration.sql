-- Backfill targetType from the legacy AnnouncementScope-typed targetScope on
-- both campaign tables before dropping it. Only fills rows where targetType is
-- still at its default (ALL_MEMBERS) and the legacy scope hints at a different
-- audience. Pre-customer staging is expected to have zero rows needing this —
-- new writes have always set targetType — but the guard is cheap.

-- SmsCampaign
UPDATE "SmsCampaign"
SET "targetType" = 'ALL_GUARDIANS'
WHERE "targetType" = 'ALL_MEMBERS' AND "targetScope" = 'GUARDIAN';

UPDATE "SmsCampaign"
SET "targetType" = 'PROGRAM_ANY_INSTANCE'
WHERE "targetType" = 'ALL_MEMBERS' AND "targetScope" = 'PROGRAM';

UPDATE "SmsCampaign"
SET "targetType" = 'ALL_PROGRAM_REGISTRANTS'
WHERE "targetType" = 'ALL_MEMBERS' AND "targetScope" = 'EVENT';

-- EmailCampaign
UPDATE "EmailCampaign"
SET "targetType" = 'ALL_GUARDIANS'
WHERE "targetType" = 'ALL_MEMBERS' AND "targetScope" = 'GUARDIAN';

UPDATE "EmailCampaign"
SET "targetType" = 'PROGRAM_ANY_INSTANCE'
WHERE "targetType" = 'ALL_MEMBERS' AND "targetScope" = 'PROGRAM';

UPDATE "EmailCampaign"
SET "targetType" = 'ALL_PROGRAM_REGISTRANTS'
WHERE "targetType" = 'ALL_MEMBERS' AND "targetScope" = 'EVENT';

-- AlterTable
ALTER TABLE "SmsCampaign" DROP COLUMN "targetScope";
ALTER TABLE "EmailCampaign" DROP COLUMN "targetScope";
