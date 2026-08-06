-- AlterTable
ALTER TABLE "PlannedBill"
ADD COLUMN "source" TEXT,
ADD COLUMN "note" TEXT;

-- AlterTable
ALTER TABLE "PlannedIncome"
ADD COLUMN "source" TEXT,
ADD COLUMN "note" TEXT;
