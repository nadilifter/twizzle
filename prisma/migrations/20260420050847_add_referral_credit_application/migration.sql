-- CreateTable
CREATE TABLE "ReferralCreditApplication" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "subscriptionInvoiceId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthsApplied" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "ReferralCreditApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCreditApplication_subscriptionInvoiceId_key" ON "ReferralCreditApplication"("subscriptionInvoiceId");

-- CreateIndex
CREATE INDEX "ReferralCreditApplication_referralId_idx" ON "ReferralCreditApplication"("referralId");

-- AddForeignKey
ALTER TABLE "ReferralCreditApplication" ADD CONSTRAINT "ReferralCreditApplication_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCreditApplication" ADD CONSTRAINT "ReferralCreditApplication_subscriptionInvoiceId_fkey" FOREIGN KEY ("subscriptionInvoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
