import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { DEMO_DATE, DEMO_INSTANT, DEMO_MONTH, DEMO_START_MONTH, demoCategories, demoTemplates } from "@/lib/demo/fixtures";
import { localDateSchema, transactionInputSchema } from "./transaction";

const id = z.string().cuid().max(80);
export const demoAmountSchema = z.string().max(15).regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/, "Enter a positive amount with up to 12 whole digits and 2 decimals.")
  .refine((value) => /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value) && new Prisma.Decimal(value).gt(0), "Amount must be greater than 0.");
const date = localDateSchema.refine((value) => value >= `${DEMO_START_MONTH}-01` && value <= DEMO_DATE, "Use a date between September 1, 2024 and the example date, September 15, 2026.");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine((value) => value >= DEMO_START_MONTH && value <= DEMO_MONTH, "Month is outside the demo calendar.");

export const demoFieldsSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]), amount: demoAmountSchema, localDate: date,
  categoryId: id, subcategoryId: id.nullable(),
  source: z.string().max(120).nullable(), note: z.string().max(500).nullable(),
}).strict().superRefine((value, context) => {
  const parsed = transactionInputSchema.safeParse({ ...value, subcategoryId: value.subcategoryId ?? undefined, source: value.source ?? undefined, note: value.note ?? undefined });
  if (!parsed.success) for (const issue of parsed.error.issues) context.addIssue({ ...issue });
  const category = demoCategories.find((item) => item.id === value.categoryId);
  if (!category || category.type !== value.type) context.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a demo category matching the transaction type." });
  if (value.subcategoryId && !category?.subcategories.some((item) => item.id === value.subcategoryId)) context.addIssue({ code: "custom", path: ["subcategoryId"], message: "Subcategory must belong to the selected category." });
});

const transaction = z.object({
  id, type: z.enum(["INCOME", "EXPENSE"]), amount: demoAmountSchema, localDate: date,
  categoryId: id, subcategoryId: id.nullable(), source: z.string().max(120).nullable(), note: z.string().max(500).nullable(),
  createdAt: z.string().datetime().refine((value) => value >= `${DEMO_START_MONTH}-01T00:00:00.000Z` && value <= DEMO_INSTANT, "Invalid demo entry timestamp."),
}).strict();
const occurrence = z.object({
  templateId: id, month, status: z.enum(["PAID", "RECEIVED", "SKIPPED"]),
  transactionId: id.nullable(), paymentSource: z.enum(["GENERATED", "LINKED"]).nullable(),
}).strict();

export const demoSnapshotSchema = z.object({
  version: z.literal(1), transactions: z.array(transaction).max(500, "Demo limit reached: reset the demo to start again."),
  occurrences: z.array(occurrence).max(demoTemplates.length * 25),
}).strict().superRefine((value, context) => {
  const transactions = new Map(value.transactions.map((item) => [item.id, item]));
  if (transactions.size !== value.transactions.length) context.addIssue({ code: "custom", message: "Duplicate demo transaction IDs." });
  for (const [index, row] of value.transactions.entries()) {
    const { id: ignoredId, createdAt: ignoredTimestamp, ...fields } = row;
    void ignoredId; void ignoredTimestamp;
    const parsed = demoFieldsSchema.safeParse(fields);
    if (!parsed.success) for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: ["transactions", index, ...issue.path] });
  }
  const keys = new Set<string>();
  const linkedIds = new Set<string>();
  for (const row of value.occurrences) {
    const key = `${row.templateId}:${row.month}`;
    const template = demoTemplates.find((item) => item.id === row.templateId);
    const linked = row.transactionId ? transactions.get(row.transactionId) : null;
    let valid = !!template && !keys.has(key);
    if (row.status === "SKIPPED") valid = valid && row.transactionId === null && row.paymentSource === null;
    else valid = valid && !!linked && row.paymentSource !== null && !linkedIds.has(row.transactionId!) &&
      linked.type === template?.type && linked.localDate.startsWith(`${row.month}-`) &&
      row.status === (template?.type === "EXPENSE" ? "PAID" : "RECEIVED");
    if (!valid) context.addIssue({ code: "custom", message: "Invalid or duplicate planned occurrence. Undo handling before changing a linked transaction's type or month." });
    keys.add(key);
    if (row.transactionId) linkedIds.add(row.transactionId);
  }
});

export const demoCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("calculate") }).strict(),
  z.object({ kind: z.literal("create"), fields: demoFieldsSchema }).strict(),
  z.object({ kind: z.literal("update"), id, fields: demoFieldsSchema }).strict(),
  z.object({ kind: z.literal("delete"), id }).strict(),
  z.object({ kind: z.literal("handle"), templateId: id, month, amount: demoAmountSchema, localDate: date, note: z.string().max(500) }).strict(),
  z.object({ kind: z.literal("skip"), templateId: id, month }).strict(),
  z.object({ kind: z.literal("undo"), templateId: id, month }).strict(),
  z.object({ kind: z.literal("link"), templateId: id, month, transactionId: id }).strict(),
]);
