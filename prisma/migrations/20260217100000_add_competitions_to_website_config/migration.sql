-- AlterTable: WebsiteConfig - add Competitions marketing fields
ALTER TABLE "WebsiteConfig" ADD COLUMN "showCompetitions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebsiteConfig" ADD COLUMN "competitionsHeading" TEXT;
ALTER TABLE "WebsiteConfig" ADD COLUMN "competitionsDescription" TEXT;
ALTER TABLE "WebsiteConfig" ADD COLUMN "competitionsCtaText" TEXT;
