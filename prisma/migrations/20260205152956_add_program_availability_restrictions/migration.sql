-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "hasAgeRestriction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCapacityRestriction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasLevelRestriction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasMembershipRestriction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxAge" INTEGER,
ADD COLUMN     "minAge" INTEGER;

-- CreateTable
CREATE TABLE "ProgramLevelRequirement" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramLevelRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDeduplication" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDeduplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramLevelRequirement_programId_idx" ON "ProgramLevelRequirement"("programId");

-- CreateIndex
CREATE INDEX "ProgramLevelRequirement_levelId_idx" ON "ProgramLevelRequirement"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramLevelRequirement_programId_levelId_key" ON "ProgramLevelRequirement"("programId", "levelId");

-- CreateIndex
CREATE INDEX "NotificationDeduplication_ruleId_idx" ON "NotificationDeduplication"("ruleId");

-- CreateIndex
CREATE INDEX "NotificationDeduplication_sentAt_idx" ON "NotificationDeduplication"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDeduplication_ruleId_entityType_entityId_family_key" ON "NotificationDeduplication"("ruleId", "entityType", "entityId", "familyId");

-- AddForeignKey
ALTER TABLE "ProgramLevelRequirement" ADD CONSTRAINT "ProgramLevelRequirement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramLevelRequirement" ADD CONSTRAINT "ProgramLevelRequirement_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDeduplication" ADD CONSTRAINT "NotificationDeduplication_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
