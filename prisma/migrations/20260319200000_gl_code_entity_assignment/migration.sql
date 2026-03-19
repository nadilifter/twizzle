-- CreateEnum
CREATE TYPE "GLCodeEntityType" AS ENUM ('PROGRAM', 'EVENT', 'COMPETITION', 'MEMBERSHIP', 'PASS', 'PRODUCT');

-- AlterTable: GLCode - add new fields, change unique constraint
ALTER TABLE "GLCode" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GLCode" ADD COLUMN "defaultForType" "GLCodeEntityType";

-- Drop old unique index on code alone, add compound unique on (code, organizationId)
DROP INDEX "GLCode_code_key";
CREATE UNIQUE INDEX "GLCode_code_organizationId_key" ON "GLCode"("code", "organizationId");
CREATE INDEX "GLCode_organizationId_idx" ON "GLCode"("organizationId");

-- AlterTable: Program - add glCodeId
ALTER TABLE "Program" ADD COLUMN "glCodeId" TEXT;
CREATE INDEX "Program_glCodeId_idx" ON "Program"("glCodeId");
ALTER TABLE "Program" ADD CONSTRAINT "Program_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "GLCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Event - add glCodeId
ALTER TABLE "Event" ADD COLUMN "glCodeId" TEXT;
CREATE INDEX "Event_glCodeId_idx" ON "Event"("glCodeId");
ALTER TABLE "Event" ADD CONSTRAINT "Event_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "GLCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: MembershipGroup - add glCodeId
ALTER TABLE "MembershipGroup" ADD COLUMN "glCodeId" TEXT;
CREATE INDEX "MembershipGroup_glCodeId_idx" ON "MembershipGroup"("glCodeId");
ALTER TABLE "MembershipGroup" ADD CONSTRAINT "MembershipGroup_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "GLCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Product - add glCodeId
ALTER TABLE "Product" ADD COLUMN "glCodeId" TEXT;
CREATE INDEX "Product_glCodeId_idx" ON "Product"("glCodeId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "GLCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Competition - add glCodeId
ALTER TABLE "Competition" ADD COLUMN "glCodeId" TEXT;
CREATE INDEX "Competition_glCodeId_idx" ON "Competition"("glCodeId");
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "GLCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Pass - add glCodeId
ALTER TABLE "Pass" ADD COLUMN "glCodeId" TEXT;
CREATE INDEX "Pass_glCodeId_idx" ON "Pass"("glCodeId");
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "GLCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: LineItem - add glCodeId
ALTER TABLE "LineItem" ADD COLUMN "glCodeId" TEXT;
CREATE INDEX "LineItem_glCodeId_idx" ON "LineItem"("glCodeId");
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_glCodeId_fkey" FOREIGN KEY ("glCodeId") REFERENCES "GLCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
