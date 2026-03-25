-- AlterTable
ALTER TABLE "WebsiteConfig" ADD COLUMN "showTeam" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TeamMemberHighlight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "overrideImage" TEXT,
    "bio" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemberHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberHighlight_memberId_key" ON "TeamMemberHighlight"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberHighlight_organizationId_memberId_key" ON "TeamMemberHighlight"("organizationId", "memberId");

-- AddForeignKey
ALTER TABLE "TeamMemberHighlight" ADD CONSTRAINT "TeamMemberHighlight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberHighlight" ADD CONSTRAINT "TeamMemberHighlight_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
