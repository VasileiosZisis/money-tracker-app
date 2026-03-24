-- CreateTable
CREATE TABLE "PlannedBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDayOfMonth" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedBill_userId_isActive_idx" ON "PlannedBill"("userId", "isActive");

-- CreateIndex
CREATE INDEX "PlannedBill_userId_dueDayOfMonth_idx" ON "PlannedBill"("userId", "dueDayOfMonth");

-- AddForeignKey
ALTER TABLE "PlannedBill" ADD CONSTRAINT "PlannedBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedBill" ADD CONSTRAINT "PlannedBill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
