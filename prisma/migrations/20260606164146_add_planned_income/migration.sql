-- CreateEnum
CREATE TYPE "PlannedIncomeOccurrenceStatus" AS ENUM ('RECEIVED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PlannedIncomeOccurrencePaymentSource" AS ENUM ('GENERATED', 'LINKED');

-- CreateTable
CREATE TABLE "PlannedIncome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "expectedDayOfMonth" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tagId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedIncomeOccurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plannedIncomeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "PlannedIncomeOccurrenceStatus" NOT NULL,
    "transactionId" TEXT,
    "receivedAtLocalDate" TEXT,
    "paymentSource" "PlannedIncomeOccurrencePaymentSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedIncomeOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedIncome_userId_isActive_idx" ON "PlannedIncome"("userId", "isActive");

-- CreateIndex
CREATE INDEX "PlannedIncome_userId_expectedDayOfMonth_idx" ON "PlannedIncome"("userId", "expectedDayOfMonth");

-- CreateIndex
CREATE INDEX "PlannedIncome_userId_tagId_idx" ON "PlannedIncome"("userId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedIncomeOccurrence_transactionId_key" ON "PlannedIncomeOccurrence"("transactionId");

-- CreateIndex
CREATE INDEX "PlannedIncomeOccurrence_userId_month_idx" ON "PlannedIncomeOccurrence"("userId", "month");

-- CreateIndex
CREATE INDEX "PlannedIncomeOccurrence_userId_status_idx" ON "PlannedIncomeOccurrence"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedIncomeOccurrence_plannedIncomeId_month_key" ON "PlannedIncomeOccurrence"("plannedIncomeId", "month");

-- AddForeignKey
ALTER TABLE "PlannedIncome" ADD CONSTRAINT "PlannedIncome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedIncome" ADD CONSTRAINT "PlannedIncome_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedIncome" ADD CONSTRAINT "PlannedIncome_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedIncomeOccurrence" ADD CONSTRAINT "PlannedIncomeOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedIncomeOccurrence" ADD CONSTRAINT "PlannedIncomeOccurrence_plannedIncomeId_fkey" FOREIGN KEY ("plannedIncomeId") REFERENCES "PlannedIncome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedIncomeOccurrence" ADD CONSTRAINT "PlannedIncomeOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
