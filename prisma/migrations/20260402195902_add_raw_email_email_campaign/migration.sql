/*
  Warnings:

  - You are about to drop the column `termsAcceptedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `CacheVersion` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "processingFeePaidBy" "FeePayer" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "termsAcceptedAt";

-- DropTable
DROP TABLE "CacheVersion";
