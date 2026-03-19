-- CreateTable
CREATE TABLE "SmsNumberAssignment" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "twilioNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsNumberAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsNumberAssignment_twilioNumber_phone_idx" ON "SmsNumberAssignment"("twilioNumber", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "SmsNumberAssignment_phone_organizationId_key" ON "SmsNumberAssignment"("phone", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsNumberAssignment_phone_twilioNumber_key" ON "SmsNumberAssignment"("phone", "twilioNumber");

-- AddForeignKey
ALTER TABLE "SmsNumberAssignment" ADD CONSTRAINT "SmsNumberAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
