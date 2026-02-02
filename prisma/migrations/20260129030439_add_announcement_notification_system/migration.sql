-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_announcementId_idx" ON "AnnouncementRead"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "SystemAnnouncementRead_userId_idx" ON "SystemAnnouncementRead"("userId");

-- CreateIndex
CREATE INDEX "SystemAnnouncementRead_announcementId_idx" ON "SystemAnnouncementRead"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemAnnouncementRead_announcementId_userId_key" ON "SystemAnnouncementRead"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAnnouncement" ADD CONSTRAINT "SystemAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAnnouncementRead" ADD CONSTRAINT "SystemAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "SystemAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAnnouncementRead" ADD CONSTRAINT "SystemAnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
