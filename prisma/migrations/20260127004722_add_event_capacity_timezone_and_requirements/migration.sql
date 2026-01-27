-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "_EventToMembershipInstance" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventToMembershipInstance_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_EventToMembershipInstance_B_index" ON "_EventToMembershipInstance"("B");

-- AddForeignKey
ALTER TABLE "_EventToMembershipInstance" ADD CONSTRAINT "_EventToMembershipInstance_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventToMembershipInstance" ADD CONSTRAINT "_EventToMembershipInstance_B_fkey" FOREIGN KEY ("B") REFERENCES "MembershipInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
