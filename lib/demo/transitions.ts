import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

import { DEMO_INSTANT, demoTemplates } from "./fixtures";
import { getGeneratedTransactionMetadata } from "@/lib/planned-items";
import { demoCommandSchema, demoSnapshotSchema } from "@/lib/validators/demo";
import type { DemoSnapshot } from "./types";

// Pure sandbox transitions: no auth, Prisma queries, or real-account actions.
export function transitionDemo(snapshotInput: unknown, commandInput: unknown): DemoSnapshot {
  const current = demoSnapshotSchema.parse(snapshotInput);
  const command = demoCommandSchema.parse(commandInput);
  const snapshot: DemoSnapshot = structuredClone(current);
  const newId = () => `c${randomBytes(12).toString("hex")}`;
  function normalizeSnapshot(): DemoSnapshot {
    snapshot.transactions = snapshot.transactions.map((row) => ({ ...row, amount: new Prisma.Decimal(row.amount).toFixed(2), source: row.source?.trim() || null, note: row.note?.trim() || null }));
    return demoSnapshotSchema.parse(snapshot);
  }
  if (command.kind === "calculate") return normalizeSnapshot();
  if (command.kind === "create") {
    snapshot.transactions.push({ ...command.fields, id: newId(), createdAt: DEMO_INSTANT });
  } else if (command.kind === "update") {
    const index = snapshot.transactions.findIndex((row) => row.id === command.id);
    if (index < 0) throw new Error("Demo transaction not found.");
    snapshot.transactions[index] = { ...snapshot.transactions[index], ...command.fields };
  } else if (command.kind === "delete") {
    if (!snapshot.transactions.some((row) => row.id === command.id)) throw new Error("Demo transaction not found.");
    snapshot.transactions = snapshot.transactions.filter((row) => row.id !== command.id);
    snapshot.occurrences = snapshot.occurrences.filter((row) => row.transactionId !== command.id);
  } else {
    const template = demoTemplates.find((row) => row.id === command.templateId);
    if (!template) throw new Error("Demo planned item not found.");
    const existing = snapshot.occurrences.find((row) => row.templateId === template.id && row.month === command.month);
    if (command.kind === "undo") {
      if (!existing) throw new Error("This item has not been handled.");
      if (existing.paymentSource === "GENERATED") snapshot.transactions = snapshot.transactions.filter((row) => row.id !== existing.transactionId);
      snapshot.occurrences = snapshot.occurrences.filter((row) => row !== existing);
    } else {
      if (existing && existing.status !== "SKIPPED") throw new Error("Undo the existing handling first.");
      let transactionId: string | null = null;
      let paymentSource: "GENERATED" | "LINKED" | null = null;
      if (command.kind === "handle") {
        if (!command.localDate.startsWith(`${command.month}-`)) throw new Error("Payment or receipt date must be inside the selected month.");
        transactionId = newId(); paymentSource = "GENERATED";
        snapshot.transactions.push({
          id: transactionId, type: template.type, amount: command.amount, localDate: command.localDate,
          categoryId: template.categoryId, subcategoryId: template.subcategoryId,
          ...getGeneratedTransactionMetadata(template, command.note.trim() || undefined), createdAt: DEMO_INSTANT,
        });
      } else if (command.kind === "link") {
        const transaction = snapshot.transactions.find((row) => row.id === command.transactionId);
        if (!transaction || transaction.type !== template.type || !transaction.localDate.startsWith(`${command.month}-`)) throw new Error("Choose a transaction of the matching type in this month.");
        if (snapshot.occurrences.some((row) => row.transactionId === transaction.id)) throw new Error("This transaction is already linked to a planned item.");
        transactionId = transaction.id; paymentSource = "LINKED";
      }
      snapshot.occurrences = snapshot.occurrences.filter((row) => row !== existing);
      snapshot.occurrences.push({ templateId: template.id, month: command.month, status: command.kind === "skip" ? "SKIPPED" : template.type === "EXPENSE" ? "PAID" : "RECEIVED", transactionId, paymentSource });
    }
  }
  // Updates cannot silently invalidate relationships or exceed snapshot bounds.
  return normalizeSnapshot();
}
