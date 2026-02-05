-- Add Adyen fields to OrganizationSubscription
ALTER TABLE "OrganizationSubscription" ADD COLUMN "adyenShopperReference" TEXT;
ALTER TABLE "OrganizationSubscription" ADD COLUMN "adyenRecurringDetailRef" TEXT;

-- Create unique index on adyenShopperReference
CREATE UNIQUE INDEX "OrganizationSubscription_adyenShopperReference_key" ON "OrganizationSubscription"("adyenShopperReference");

-- Create OrganizationPaymentMethod table for SaaS subscription billing
CREATE TABLE "OrganizationPaymentMethod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storedPaymentMethodId" TEXT NOT NULL,
    "shopperReference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "lastFour" TEXT NOT NULL,
    "expiryMonth" TEXT,
    "expiryYear" TEXT,
    "holderName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- Create unique index on storedPaymentMethodId
CREATE UNIQUE INDEX "OrganizationPaymentMethod_storedPaymentMethodId_key" ON "OrganizationPaymentMethod"("storedPaymentMethodId");

-- Create index on organizationId
CREATE INDEX "OrganizationPaymentMethod_organizationId_idx" ON "OrganizationPaymentMethod"("organizationId");

-- Create index on shopperReference
CREATE INDEX "OrganizationPaymentMethod_shopperReference_idx" ON "OrganizationPaymentMethod"("shopperReference");

-- Add foreign key constraint
ALTER TABLE "OrganizationPaymentMethod" ADD CONSTRAINT "OrganizationPaymentMethod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
