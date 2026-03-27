import { Prisma } from "@/generated/prisma/client";
import { categoryIdSchema } from "@/lib/validators/category";
import { z } from "zod";

const LOCAL_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

const amountSchema = z
  .union([z.string(), z.number()])
  .transform((raw) => (typeof raw === "number" ? raw.toString() : raw.trim()))
  .refine((value) => value.length > 0, "Amount is required.")
  .refine(
    (value) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value),
    "Amount must be a valid number with up to 2 decimals."
  )
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.gt(0), "Amount must be greater than 0.");

const optionalString = (maxLength: number) =>
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

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const localDateSchema = z
  .string()
  .refine(isValidLocalDate, "Date must be in YYYY-MM-DD format.");

export const transactionInputSchema = z.object({
  type: transactionTypeSchema,
  amount: amountSchema,
  localDate: localDateSchema,
  categoryId: categoryIdSchema,
  source: optionalString(120),
  note: optionalString(500),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
