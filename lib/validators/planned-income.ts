import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { categoryIdSchema } from "@/lib/validators/category";
import { optionalTagIdSchema } from "@/lib/validators/tag";
import { localDateSchema } from "@/lib/validators/transaction";

export const plannedIncomeIdSchema = z.string().cuid("Invalid planned income id.");
export const plannedIncomeOccurrenceMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format.");
export const plannedIncomeTransactionIdSchema = z
  .string()
  .cuid("Invalid transaction id.");

export const plannedIncomeAmountSchema = z
  .union([z.string(), z.number()])
  .transform((raw) => (typeof raw === "number" ? raw.toString() : raw.trim()))
  .refine((value) => value.length > 0, "Amount is required.")
  .refine(
    (value) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value),
    "Amount must be a valid number with up to 2 decimals.",
  )
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.gt(0), "Amount must be greater than 0.");

export const plannedIncomeExpectedDaySchema = z
  .number()
  .int("Expected day must be a whole number.")
  .min(1, "Expected day must be between 1 and 28.")
  .max(28, "Expected day must be between 1 and 28.");

export const plannedIncomeNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must be 120 characters or fewer.");

export const plannedIncomeInputSchema = z.object({
  name: plannedIncomeNameSchema,
  amount: plannedIncomeAmountSchema,
  expectedDayOfMonth: z.coerce.number().pipe(plannedIncomeExpectedDaySchema),
  categoryId: categoryIdSchema,
  tagId: optionalTagIdSchema,
  isActive: z.boolean({
    required_error: "Active status is required.",
    invalid_type_error: "Active status must be a boolean.",
  }),
});

export const updatePlannedIncomeSchema = plannedIncomeInputSchema.extend({
  id: plannedIncomeIdSchema,
});

export const togglePlannedIncomeActiveSchema = z.object({
  id: plannedIncomeIdSchema,
  isActive: z.boolean({
    required_error: "Active status is required.",
    invalid_type_error: "Active status must be a boolean.",
  }),
});

export const markPlannedIncomeReceivedSchema = z
  .object({
    plannedIncomeId: plannedIncomeIdSchema,
    month: plannedIncomeOccurrenceMonthSchema,
    amount: plannedIncomeAmountSchema,
    localDate: localDateSchema,
    note: z
      .string()
      .trim()
      .max(500, "Note must be 500 characters or fewer.")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
  })
  .refine((value) => value.localDate.startsWith(`${value.month}-`), {
    message: "Received date must be inside the selected month.",
    path: ["localDate"],
  });

export const skipPlannedIncomeForMonthSchema = z.object({
  plannedIncomeId: plannedIncomeIdSchema,
  month: plannedIncomeOccurrenceMonthSchema,
});

export const undoPlannedIncomeOccurrenceSchema = z.object({
  plannedIncomeId: plannedIncomeIdSchema,
  month: plannedIncomeOccurrenceMonthSchema,
});

export const linkExistingTransactionToPlannedIncomeSchema = z.object({
  plannedIncomeId: plannedIncomeIdSchema,
  transactionId: plannedIncomeTransactionIdSchema,
  month: plannedIncomeOccurrenceMonthSchema,
});

export type PlannedIncomeInput = {
  name: string;
  amount: string | number;
  expectedDayOfMonth: string | number;
  categoryId: string;
  tagId?: string;
  isActive: boolean;
};

export type UpdatePlannedIncomeInput = PlannedIncomeInput & {
  id: string;
};

export type TogglePlannedIncomeActiveInput = {
  id: string;
  isActive: boolean;
};

export type MarkPlannedIncomeReceivedInput = {
  plannedIncomeId: string;
  month: string;
  amount: string | number;
  localDate: string;
  note?: string;
};

export type SkipPlannedIncomeForMonthInput = {
  plannedIncomeId: string;
  month: string;
};

export type UndoPlannedIncomeOccurrenceInput = {
  plannedIncomeId: string;
  month: string;
};

export type LinkExistingTransactionToPlannedIncomeInput = {
  plannedIncomeId: string;
  transactionId: string;
  month: string;
};
