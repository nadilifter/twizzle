-- AlterTable
ALTER TABLE "WebsiteConfig" ALTER COLUMN "showStore" SET DEFAULT true;

-- Set existing rows to true
UPDATE "WebsiteConfig" SET "showStore" = true WHERE "showStore" = false;
