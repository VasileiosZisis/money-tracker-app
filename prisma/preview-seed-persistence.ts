import { Prisma } from "../generated/prisma/client";
import { buildPreviewData, inheritGeneratedMetadata, insertMissing } from "./preview-seed";

async function prepareMetadata(tx: Prisma.TransactionClient, data: ReturnType<typeof buildPreviewData>) {
  const bills = await tx.plannedBill.findMany({ where: { userId: data.categories[0].userId, id: { in: data.bills.map(r => r.id) } } });
  const incomes = await tx.plannedIncome.findMany({ where: { userId: data.categories[0].userId, id: { in: data.incomes.map(r => r.id) } } });
  inheritGeneratedMetadata(data, [...bills, ...incomes]);
  return "verified";
}

export async function persistPreviewData(tx: Prisma.TransactionClient, data: ReturnType<typeof buildPreviewData>, userId: string) {
  const result = {
    categories: await insertMissing(data.categories, () => tx.category.findMany({ where: { id: { in: data.categories.map(r => r.id) } } }), rows => tx.category.createMany({ data: rows })),
    subcategories: await insertMissing(data.subcategories, () => tx.subcategory.findMany({ where: { id: { in: data.subcategories.map(r => r.id) } } }), rows => tx.subcategory.createMany({ data: rows })),
    bills: await insertMissing(data.bills, () => tx.plannedBill.findMany({ where: { id: { in: data.bills.map(r => r.id) } } }), rows => tx.plannedBill.createMany({ data: rows })),
    incomes: await insertMissing(data.incomes, () => tx.plannedIncome.findMany({ where: { id: { in: data.incomes.map(r => r.id) } } }), rows => tx.plannedIncome.createMany({ data: rows })),
    metadata: await prepareMetadata(tx, data),
    transactions: await insertMissing(data.transactions, () => tx.transaction.findMany({ where: { id: { in: data.transactions.map(r => r.id) } } }), rows => tx.transaction.createMany({ data: rows })),
    billOccurrences: await insertMissing(data.billOccurrences, () => tx.plannedBillOccurrence.findMany({ where: { id: { in: data.billOccurrences.map(r => r.id) } } }), rows => tx.plannedBillOccurrence.createMany({ data: rows })),
    incomeOccurrences: await insertMissing(data.incomeOccurrences, () => tx.plannedIncomeOccurrence.findMany({ where: { id: { in: data.incomeOccurrences.map(r => r.id) } } }), rows => tx.plannedIncomeOccurrence.createMany({ data: rows })),
    adjustments: await insertMissing(data.adjustments, () => tx.balanceAdjustment.findMany({ where: { id: { in: data.adjustments.map(r => r.id) } } }), rows => tx.balanceAdjustment.createMany({ data: rows })),
  };
  const noWrites = async () => { throw new Error("Verification failed: missing sample records"); };
  await insertMissing(data.transactions, () => tx.transaction.findMany({ where: { userId: userId, id: { in: data.transactions.map(r => r.id) } } }), noWrites);
  await insertMissing(data.billOccurrences, () => tx.plannedBillOccurrence.findMany({ where: { userId: userId, id: { in: data.billOccurrences.map(r => r.id) } } }), noWrites);
  await insertMissing(data.incomeOccurrences, () => tx.plannedIncomeOccurrence.findMany({ where: { userId: userId, id: { in: data.incomeOccurrences.map(r => r.id) } } }), noWrites);
  return result;
}

