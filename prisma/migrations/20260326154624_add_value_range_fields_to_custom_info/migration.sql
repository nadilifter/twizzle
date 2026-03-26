-- AlterTable
ALTER TABLE "CustomInfoQuestion" ADD COLUMN     "allowDecimals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valueMax" DOUBLE PRECISION,
ADD COLUMN     "valueMin" DOUBLE PRECISION;
