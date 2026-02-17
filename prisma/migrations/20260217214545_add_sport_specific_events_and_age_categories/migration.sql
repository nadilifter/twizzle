-- AlterTable
ALTER TABLE "CompetitionCategory" ADD COLUMN     "ageCategoryId" TEXT,
ADD COLUMN     "sportEventId" TEXT;

-- CreateTable
CREATE TABLE "SportEvent" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventGroup" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resultType" "ResultType" NOT NULL,
    "sortDirection" "SortDirection" NOT NULL,
    "defaultPrecision" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportAgeCategory" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SportAgeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportEventEligibility" (
    "id" TEXT NOT NULL,
    "sportEventId" TEXT NOT NULL,
    "ageCategoryId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SportEventEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SportEvent_sportId_idx" ON "SportEvent"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "SportEvent_sportId_code_key" ON "SportEvent"("sportId", "code");

-- CreateIndex
CREATE INDEX "SportAgeCategory_sportId_idx" ON "SportAgeCategory"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "SportAgeCategory_sportId_code_key" ON "SportAgeCategory"("sportId", "code");

-- CreateIndex
CREATE INDEX "SportEventEligibility_sportEventId_idx" ON "SportEventEligibility"("sportEventId");

-- CreateIndex
CREATE INDEX "SportEventEligibility_ageCategoryId_idx" ON "SportEventEligibility"("ageCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SportEventEligibility_sportEventId_ageCategoryId_key" ON "SportEventEligibility"("sportEventId", "ageCategoryId");

-- CreateIndex
CREATE INDEX "CompetitionCategory_sportEventId_idx" ON "CompetitionCategory"("sportEventId");

-- CreateIndex
CREATE INDEX "CompetitionCategory_ageCategoryId_idx" ON "CompetitionCategory"("ageCategoryId");

-- AddForeignKey
ALTER TABLE "SportEvent" ADD CONSTRAINT "SportEvent_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportAgeCategory" ADD CONSTRAINT "SportAgeCategory_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportEventEligibility" ADD CONSTRAINT "SportEventEligibility_sportEventId_fkey" FOREIGN KEY ("sportEventId") REFERENCES "SportEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportEventEligibility" ADD CONSTRAINT "SportEventEligibility_ageCategoryId_fkey" FOREIGN KEY ("ageCategoryId") REFERENCES "SportAgeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCategory" ADD CONSTRAINT "CompetitionCategory_sportEventId_fkey" FOREIGN KEY ("sportEventId") REFERENCES "SportEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionCategory" ADD CONSTRAINT "CompetitionCategory_ageCategoryId_fkey" FOREIGN KEY ("ageCategoryId") REFERENCES "SportAgeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
