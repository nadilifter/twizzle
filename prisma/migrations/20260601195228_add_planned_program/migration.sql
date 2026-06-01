-- CreateTable
CREATE TABLE "PlannedProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" "Discipline",
    "category" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedProgramElement" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "elementCode" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "elementKind" TEXT NOT NULL,
    "baseValue" DOUBLE PRECISION NOT NULL,
    "inSecondHalf" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedProgramElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedProgram_organizationId_athleteId_idx" ON "PlannedProgram"("organizationId", "athleteId");

-- CreateIndex
CREATE INDEX "PlannedProgram_athleteId_updatedAt_idx" ON "PlannedProgram"("athleteId", "updatedAt");

-- CreateIndex
CREATE INDEX "PlannedProgramElement_programId_idx" ON "PlannedProgramElement"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedProgramElement_programId_position_key" ON "PlannedProgramElement"("programId", "position");

-- AddForeignKey
ALTER TABLE "PlannedProgram" ADD CONSTRAINT "PlannedProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedProgram" ADD CONSTRAINT "PlannedProgram_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedProgram" ADD CONSTRAINT "PlannedProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedProgramElement" ADD CONSTRAINT "PlannedProgramElement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PlannedProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
