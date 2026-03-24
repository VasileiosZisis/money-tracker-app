import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { localDateSchema, transactionTypeSchema } from "@/lib/validators/transaction";

const importAmountSchema = z
  .union([z.string(), z.number()])
  .transform((raw) => (typeof raw === "number" ? raw.toString() : raw.trim()))
  .refine((value) => value.length > 0, "Amount is required.")
  .refine(
    (value) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value),
    "Amount must be a valid number with up to 2 decimals."
  )
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.gt(0), "Amount must be greater than 0.");

const optionalImportString = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(maxLength).optional()
  );

export const importPreviewFieldNames = [
  "localDate",
  "type",
  "category",
  "amount",
  "source",
  "note",
] as const;

export const importPreviewRowSchema = z.object({
  localDate: localDateSchema,
  type: transactionTypeSchema,
  category: z.string().trim().min(1, "Category is required."),
  amount: importAmountSchema,
  source: optionalImportString(120),
  note: optionalImportString(500),
});

export type ImportPreviewFieldName = (typeof importPreviewFieldNames)[number];
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
