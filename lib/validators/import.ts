import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import {
  importPreviewFieldNames,
  importRequiredFieldNames,
  type ImportColumnMapping,
  type ImportPreviewFieldName,
  type ImportRequiredFieldName,
} from "@/lib/import/shared";
import { categoryIdSchema, categoryNameSchema } from "@/lib/validators/category";
import { localDateSchema, transactionTypeSchema } from "@/lib/validators/transaction";

const importRequiredString = (message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1, message),
  );

const importAmountSchema = z
  .union([z.string(), z.number()])
  .transform((raw) => (typeof raw === "number" ? raw.toString() : raw.trim()))
  .refine((value) => value.length > 0, "Amount is required.")
  .refine(
    (value) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value),
    "Amount must be a valid number with up to 2 decimals.",
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
    z.string().max(maxLength).optional(),
  );

const previewTimestampSchema = z
  .string()
  .trim()
  .min(1, "Preview timestamp is required.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid preview timestamp.");

export const importNormalizedTypeSchema = importRequiredString("Type is required.")
  .transform((value) => value.toUpperCase())
  .refine((value) => value === "INCOME" || value === "EXPENSE", {
    message: "Type must be INCOME or EXPENSE.",
  })
  .transform((value) => value as z.infer<typeof transactionTypeSchema>);

export const importCategoryNameSchema = importRequiredString("Category is required.");

export const importPreviewRowSchema = z.object({
  localDate: importRequiredString("Date is required.").pipe(localDateSchema),
  type: importNormalizedTypeSchema,
  category: importCategoryNameSchema,
  amount: importAmountSchema,
  source: optionalImportString(120),
  note: optionalImportString(500),
});

export const importColumnMappingSchema = z
  .object({
    localDate: z.number().int().min(0).optional(),
    type: z.number().int().min(0).optional(),
    category: z.number().int().min(0).optional(),
    amount: z.number().int().min(0).optional(),
    source: z.number().int().min(0).optional(),
    note: z.number().int().min(0).optional(),
  })
  .partial() satisfies z.ZodType<ImportColumnMapping>;

export const importPreviewConfirmationRowSchema = z.object({
  rowNumber: z.number().int().min(2),
  localDate: localDateSchema,
  type: transactionTypeSchema,
  categoryName: importCategoryNameSchema,
  amount: z.string().regex(
    /^(?:0|[1-9]\d*)(?:\.\d{2})$/,
    "Amount must be a normalized decimal string.",
  ),
  source: optionalImportString(120),
  note: optionalImportString(500),
  categoryResolutionKey: z.string().trim().min(1).optional(),
  resolvedCategoryId: categoryIdSchema.optional(),
});

export const importCategoryResolutionSchema = z
  .object({
    key: z.string().trim().min(1, "Category resolution key is required."),
    action: z.enum(["map", "create"]),
    categoryId: categoryIdSchema.optional(),
    createName: categoryNameSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "map" && !value.categoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Select an existing category to map.",
      });
    }

    if (value.action === "create" && !value.createName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["createName"],
        message: "Provide a name for the category to create.",
      });
    }
  });

export const confirmImportSchema = z.object({
  previewGeneratedAt: previewTimestampSchema,
  confirmationToken: z.string().trim().min(1, "Confirmation token is required."),
  rows: z.array(importPreviewConfirmationRowSchema).min(1, "No valid rows to import."),
  categoryResolutions: z.array(importCategoryResolutionSchema).default([]),
});

export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type ImportPreviewConfirmationRow = z.infer<
  typeof importPreviewConfirmationRowSchema
>;
export type ImportCategoryResolutionInput = z.infer<
  typeof importCategoryResolutionSchema
>;
export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;
export {
  importPreviewFieldNames,
  importRequiredFieldNames,
  type ImportColumnMapping,
  type ImportPreviewFieldName,
  type ImportRequiredFieldName,
};
