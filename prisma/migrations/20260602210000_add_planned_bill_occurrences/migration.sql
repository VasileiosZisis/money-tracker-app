-- CreateEnum
CREATE TYPE "PlannedBillOccurrenceStatus" AS ENUM ('PAID', 'SKIPPED');

-- CreateTable
CREATE TABLE "PlannedBillOccurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plannedBillId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "PlannedBillOccurrenceStatus" NOT NULL,
    "transactionId" TEXT,
    "paidAtLocalDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedBillOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlannedBillOccurrence_transactionId_key" ON "PlannedBillOccurrence"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedBillOccurrence_plannedBillId_month_key" ON "PlannedBillOccurrence"("plannedBillId", "month");

-- CreateIndex
CREATE INDEX "PlannedBillOccurrence_userId_month_idx" ON "PlannedBillOccurrence"("userId", "month");

-- CreateIndex
CREATE INDEX "PlannedBillOccurrence_userId_status_idx" ON "PlannedBillOccurrence"("userId", "status");

-- AddForeignKey
ALTER TABLE "PlannedBillOccurrence" ADD CONSTRAINT "PlannedBillOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedBillOccurrence" ADD CONSTRAINT "PlannedBillOccurrence_plannedBillId_fkey" FOREIGN KEY ("plannedBillId") REFERENCES "PlannedBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedBillOccurrence" ADD CONSTRAINT "PlannedBillOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
