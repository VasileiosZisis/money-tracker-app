-- AlterTable
ALTER TABLE "PlannedBill" ADD COLUMN     "tagId" TEXT;

-- CreateIndex
CREATE INDEX "PlannedBill_userId_tagId_idx" ON "PlannedBill"("userId", "tagId");

-- AddForeignKey
ALTER TABLE "PlannedBill" ADD CONSTRAINT "PlannedBill_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
