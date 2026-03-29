-- Rename ALL_GUARDIANS -> GUARDIANS (in-place rename, existing rows update automatically)
ALTER TYPE "NotificationRecipientType" RENAME VALUE 'ALL_GUARDIANS' TO 'GUARDIANS';

-- Migrate any rows using removed values to GUARDIANS before dropping them
UPDATE "NotificationRecipientConfig"
  SET "recipientType" = 'GUARDIANS'::"NotificationRecipientType"
  WHERE "recipientType" IN ('ALL_ATHLETES', 'PROGRAM_MEMBERS');

-- Drop column default before enum recreation (it can't be auto-cast)
ALTER TABLE "NotificationRecipientConfig"
  ALTER COLUMN "recipientType" DROP DEFAULT;

-- Remove the defunct enum values by recreating the type
ALTER TYPE "NotificationRecipientType" RENAME TO "NotificationRecipientType_old";

CREATE TYPE "NotificationRecipientType" AS ENUM ('GUARDIANS', 'MEMBERSHIP_HOLDERS', 'INTERNAL_USERS', 'CUSTOM');

ALTER TABLE "NotificationRecipientConfig"
  ALTER COLUMN "recipientType" TYPE "NotificationRecipientType"
  USING "recipientType"::text::"NotificationRecipientType";

DROP TYPE "NotificationRecipientType_old";

-- Restore the column default with the new enum type
ALTER TABLE "NotificationRecipientConfig"
  ALTER COLUMN "recipientType" SET DEFAULT 'GUARDIANS'::"NotificationRecipientType";
