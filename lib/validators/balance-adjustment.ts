import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const YYYY_MM_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const YYYY_REGEX = /^\d{4}$/;
const REFERENCE_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function getReferencePeriod(referenceDate: string) {
  if (!REFERENCE_DATE_REGEX.test(referenceDate)) {
    throw new Error("Invalid reference date. Expected YYYY-MM-DD.");
  }

  const year = Number(referenceDate.slice(0, 4));
  const month = Number(referenceDate.slice(5, 7));
  const day = Number(referenceDate.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid reference date. Expected YYYY-MM-DD.");
  }

  return {
    currentMonth: referenceDate.slice(0, 7),
    currentYear: referenceDate.slice(0, 4),
  };
}

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

const optionalQueryStringSchema = z.preprocess(
  firstQueryValue,
  z.string().trim().optional(),
);

const balanceAdjustmentFields = {
  amount: z
    .string({
      required_error: "Amount is required.",
      invalid_type_error: "Amount must be a decimal string.",
    })
    .trim()
    .min(1, "Amount is required.")
    .regex(
      /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/,
      "Amount must have up to 12 integer digits and 2 decimal places.",
    )
    .transform((value) => new Prisma.Decimal(value))
    .refine((value) => value.gt(0), "Amount must be greater than 0."),
  effectiveMonth: z
    .string()
    .regex(YYYY_MM_REGEX, "Effective month must be in YYYY-MM format."),
  note: z
    .string()
    .trim()
    .max(500, "Note must be 500 characters or fewer.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
};

export const balanceAdjustmentIdSchema = z
  .string()
  .cuid("Invalid balance adjustment id.");

export const balanceAdjustmentAmountSchema = balanceAdjustmentFields.amount;
export const balanceAdjustmentEffectiveMonthSchema =
  balanceAdjustmentFields.effectiveMonth;
export const balanceAdjustmentNoteSchema = balanceAdjustmentFields.note;

export const balanceAdjustmentInputSchema = z.object(balanceAdjustmentFields);

export function createBalanceAdjustmentSchema(referenceDate: string) {
  const { currentMonth } = getReferencePeriod(referenceDate);

  return balanceAdjustmentInputSchema.refine(
    (value) => value.effectiveMonth < currentMonth,
    {
      message: "Effective month must be a completed month.",
      path: ["effectiveMonth"],
    },
  );
}

export function updateBalanceAdjustmentSchema(referenceDate: string) {
  const { currentMonth } = getReferencePeriod(referenceDate);

  return balanceAdjustmentInputSchema
    .extend({ id: balanceAdjustmentIdSchema })
    .refine((value) => value.effectiveMonth < currentMonth, {
      message: "Effective month must be a completed month.",
      path: ["effectiveMonth"],
    });
}

export const deleteBalanceAdjustmentSchema = z.object({
  id: balanceAdjustmentIdSchema,
});

export const balanceRangePresetSchema = z.enum([
  "current-year",
  "last-3-months",
  "last-6-months",
  "last-9-months",
  "last-12-months",
  "previous-1-year",
  "previous-2-years",
  "previous-3-years",
  "all-time",
  "custom",
]);

export const balancePeriodModeSchema = z.enum(["months", "years"]);

const rawBalanceRangeQuerySchema = z.object({
  balanceRange: z.preprocess(
    firstQueryValue,
    balanceRangePresetSchema.default("current-year"),
  ),
  balanceMode: optionalQueryStringSchema,
  balanceStart: optionalQueryStringSchema,
  balanceEnd: optionalQueryStringSchema,
});

export function createBalanceRangeQuerySchema(referenceDate: string) {
  const { currentMonth, currentYear } = getReferencePeriod(referenceDate);

  return rawBalanceRangeQuerySchema
    .superRefine((value, context) => {
      if (value.balanceRange !== "custom") {
        return;
      }

      const modeResult = balancePeriodModeSchema.safeParse(
        value.balanceMode ?? "months",
      );

      if (!modeResult.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Balance mode must be months or years.",
          path: ["balanceMode"],
        });
        return;
      }

      const mode = modeResult.data;
      const boundaryRegex = mode === "months" ? YYYY_MM_REGEX : YYYY_REGEX;
      const boundaryLabel = mode === "months" ? "YYYY-MM" : "YYYY";

      if (!value.balanceStart) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start period is required for a custom range.",
          path: ["balanceStart"],
        });
      } else if (!boundaryRegex.test(value.balanceStart)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Start period must be in ${boundaryLabel} format.`,
          path: ["balanceStart"],
        });
      }

      if (!value.balanceEnd) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End period is required for a custom range.",
          path: ["balanceEnd"],
        });
      } else if (!boundaryRegex.test(value.balanceEnd)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `End period must be in ${boundaryLabel} format.`,
          path: ["balanceEnd"],
        });
      }

      if (
        !value.balanceStart ||
        !value.balanceEnd ||
        !boundaryRegex.test(value.balanceStart) ||
        !boundaryRegex.test(value.balanceEnd)
      ) {
        return;
      }

      if (value.balanceStart > value.balanceEnd) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start period must be before or equal to end period.",
          path: ["balanceEnd"],
        });
      }

      const latestIncompletePeriod = mode === "months" ? currentMonth : currentYear;

      if (value.balanceEnd >= latestIncompletePeriod) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            mode === "months"
              ? "End month must be a completed month."
              : "End year must be a completed calendar year.",
          path: ["balanceEnd"],
        });
      }
    })
    .transform((value) => {
      if (value.balanceRange !== "custom") {
        return { balanceRange: value.balanceRange };
      }

      return {
        balanceRange: value.balanceRange,
        balanceMode: balancePeriodModeSchema.parse(
          value.balanceMode ?? "months",
        ),
        balanceStart: value.balanceStart as string,
        balanceEnd: value.balanceEnd as string,
      };
    });
}

export type BalanceAdjustmentInput = z.input<
  typeof balanceAdjustmentInputSchema
>;
export type ParsedBalanceAdjustmentInput = z.output<
  typeof balanceAdjustmentInputSchema
>;
export type CreateBalanceAdjustmentInput = z.input<
  ReturnType<typeof createBalanceAdjustmentSchema>
>;
export type UpdateBalanceAdjustmentInput = z.input<
  ReturnType<typeof updateBalanceAdjustmentSchema>
>;
export type DeleteBalanceAdjustmentInput = z.input<
  typeof deleteBalanceAdjustmentSchema
>;
export type BalanceRangePreset = z.infer<typeof balanceRangePresetSchema>;
export type BalancePeriodMode = z.infer<typeof balancePeriodModeSchema>;
export type BalanceRangeQueryInput = z.input<
  ReturnType<typeof createBalanceRangeQuerySchema>
>;
export type BalanceRangeQuery = z.output<
  ReturnType<typeof createBalanceRangeQuerySchema>
>;
