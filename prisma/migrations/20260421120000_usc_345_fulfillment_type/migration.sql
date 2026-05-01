-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('PICKUP_ONLY', 'DELIVERY_ONLY', 'PICKUP_OR_DELIVERY');

-- CreateEnum
CREATE TYPE "LineItemFulfillmentType" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "fulfillmentType" "FulfillmentType",
                      ADD COLUMN "pickupFacilityId" TEXT;

-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN "fulfillmentType" "LineItemFulfillmentType",
                       ADD COLUMN "pickupFacilityId" TEXT;

-- AddForeignKey
ALTER TABLE "Product"
    ADD CONSTRAINT "Product_pickupFacilityId_fkey"
    FOREIGN KEY ("pickupFacilityId") REFERENCES "Facility"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem"
    ADD CONSTRAINT "LineItem_pickupFacilityId_fkey"
    FOREIGN KEY ("pickupFacilityId") REFERENCES "Facility"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Product_pickupFacilityId_idx" ON "Product"("pickupFacilityId");

-- CreateIndex
CREATE INDEX "LineItem_pickupFacilityId_idx" ON "LineItem"("pickupFacilityId");

-- Backfill Product.pickupFacilityId with each org's isDefault facility (fallback: first ACTIVE by name).
-- Orgs with zero ACTIVE facilities leave pickupFacilityId NULL (orphan case handled by storefront).
-- These UPDATEs run unbounded; current Product and LineItem counts are small enough for a single
-- transaction. If either table grows past ~1M rows, batch in a maintenance window before rerunning.
UPDATE "Product" p
SET "pickupFacilityId" = f.id
FROM (
    SELECT DISTINCT ON ("organizationId") id, "organizationId"
    FROM "Facility"
    WHERE "status" = 'ACTIVE'
    ORDER BY "organizationId", "isDefault" DESC, "name" ASC
) f
WHERE f."organizationId" = p."organizationId"
  AND p."pickupFacilityId" IS NULL;

-- Backfill Product.fulfillmentType = PICKUP_ONLY for every row (including orphans).
UPDATE "Product" SET "fulfillmentType" = 'PICKUP_ONLY' WHERE "fulfillmentType" IS NULL;

-- Backfill existing LineItems for products to match the product's resolved pickup facility.
UPDATE "LineItem" li
SET "fulfillmentType" = 'PICKUP',
    "pickupFacilityId" = p."pickupFacilityId"
FROM "Product" p
WHERE li."productId" = p.id
  AND li."fulfillmentType" IS NULL;

-- Tighten Product.fulfillmentType to NOT NULL with PICKUP_ONLY default.
-- LineItem columns stay nullable — non-product line items (programs, passes) have no fulfillment concept.
ALTER TABLE "Product" ALTER COLUMN "fulfillmentType" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "fulfillmentType" SET DEFAULT 'PICKUP_ONLY';
