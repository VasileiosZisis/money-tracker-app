-- CreateEnum
CREATE TYPE "PlannedBillOccurrencePaymentSource" AS ENUM ('GENERATED', 'LINKED');

-- AlterTable
ALTER TABLE "PlannedBillOccurrence" ADD COLUMN     "paymentSource" "PlannedBillOccurrencePaymentSource";

-- Backfill existing app-created paid occurrences.
UPDATE "PlannedBillOccurrence"
SET "paymentSource" = 'GENERATED'
WHERE "status" = 'PAID'
  AND "transactionId" IS NOT NULL;
