-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('SINGLES', 'PAIRS', 'ICE_DANCE', 'SYNCHRO', 'SPECIAL_OLYMPICS');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "disciplines" "Discipline"[];
