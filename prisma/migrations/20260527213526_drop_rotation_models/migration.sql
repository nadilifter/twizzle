/*
  Warnings:

  - You are about to drop the `Rotation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RotationSkill` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Rotation" DROP CONSTRAINT "Rotation_lessonPlanId_fkey";

-- DropForeignKey
ALTER TABLE "RotationSkill" DROP CONSTRAINT "RotationSkill_rotationId_fkey";

-- DropForeignKey
ALTER TABLE "RotationSkill" DROP CONSTRAINT "RotationSkill_skillId_fkey";

-- DropTable
DROP TABLE "Rotation";

-- DropTable
DROP TABLE "RotationSkill";
