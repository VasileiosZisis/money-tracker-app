import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { categoryIdSchema } from "@/lib/validators/category";

const plannedBillAmountSchema = z
  .union([z.string(), z.number()])
  .transform((raw) => (typeof raw === "number" ? raw.toString() : raw.trim()))
  .refine((value) => value.length > 0, "Amount is required.")
  .refine(
    (value) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value),
    "Amount must be a valid number with up to 2 decimals."
  )
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.gt(0), "Amount must be greater than 0.");

export const plannedBillDueDaySchema = z
  .number()
  .int("Due day must be a whole number.")
  .min(1, "Due day must be between 1 and 28.")
  .max(28, "Due day must be between 1 and 28.");

export const plannedBillInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  amount: plannedBillAmountSchema,
  dueDayOfMonth: z.coerce.number().pipe(plannedBillDueDaySchema),
  categoryId: categoryIdSchema,
  isActive: z.boolean().default(true),
});

export type PlannedBillInput = z.infer<typeof plannedBillInputSchema>;
