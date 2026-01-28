-- CreateEnum
CREATE TYPE "ProgramStaffRole" AS ENUM ('LEAD_COACH', 'ASSISTANT_COACH', 'SUBSTITUTE', 'VOLUNTEER');

-- CreateTable
CREATE TABLE "ProgramStaff" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "role" "ProgramStaffRole" NOT NULL DEFAULT 'ASSISTANT_COACH',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MembershipInstanceToProgram" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MembershipInstanceToProgram_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ProgramStaff_programId_idx" ON "ProgramStaff"("programId");

-- CreateIndex
CREATE INDEX "ProgramStaff_staffProfileId_idx" ON "ProgramStaff"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramStaff_programId_staffProfileId_key" ON "ProgramStaff"("programId", "staffProfileId");

-- CreateIndex
CREATE INDEX "_MembershipInstanceToProgram_B_index" ON "_MembershipInstanceToProgram"("B");

-- AddForeignKey
ALTER TABLE "ProgramStaff" ADD CONSTRAINT "ProgramStaff_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramStaff" ADD CONSTRAINT "ProgramStaff_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MembershipInstanceToProgram" ADD CONSTRAINT "_MembershipInstanceToProgram_A_fkey" FOREIGN KEY ("A") REFERENCES "MembershipInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MembershipInstanceToProgram" ADD CONSTRAINT "_MembershipInstanceToProgram_B_fkey" FOREIGN KEY ("B") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
