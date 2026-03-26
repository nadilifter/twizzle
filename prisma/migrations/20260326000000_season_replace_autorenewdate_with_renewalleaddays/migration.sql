-- Replace autoRenewDate (DateTime?) with renewalLeadDays (Int, default 30)
ALTER TABLE "Season" ADD COLUMN "renewalLeadDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Season" DROP COLUMN "autoRenewDate";
