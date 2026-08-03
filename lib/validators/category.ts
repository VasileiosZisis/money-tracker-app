import { z } from "zod";

import {
  buildClassificationNameLookupKey,
  normalizeClassificationName,
} from "@/lib/categories/name-normalization";

export const categoryTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const categoryNameSchema = z
  .string()
  .trim()
  .transform(normalizeClassificationName)
  .pipe(
    z
      .string()
      .min(1, "Category name must be between 1 and 50 characters.")
      .max(50, "Category name must be between 1 and 50 characters."),
  );

export const categoryIdSchema = z.string().cuid("Invalid category id.");

const initialSubcategoryNameSchema = z
  .string()
  .trim()
  .transform(normalizeClassificationName)
  .pipe(
    z
      .string()
      .min(1, "Subcategory name must be between 1 and 50 characters.")
      .max(50, "Subcategory name must be between 1 and 50 characters."),
  );

const initialSubcategoryNamesSchema = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value.filter(
          (name) => typeof name !== "string" || name.trim().length > 0,
        )
      : value,
  z
    .array(initialSubcategoryNameSchema)
    .max(10, "You can add up to 10 subcategories at once.")
    .superRefine((names, context) => {
      const seenNames = new Set<string>();

      names.forEach((name, index) => {
        const lookupKey = buildClassificationNameLookupKey(name);

        if (seenNames.has(lookupKey)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Subcategory names must be unique.",
            path: [index],
          });
        }

        seenNames.add(lookupKey);
      });
    }),
);

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  type: categoryTypeSchema,
  subcategoryNames: initialSubcategoryNamesSchema.optional(),
});

export const renameCategorySchema = z.object({
  id: categoryIdSchema,
  name: categoryNameSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type RenameCategoryInput = z.infer<typeof renameCategorySchema>;
export type CategoryTypeInput = z.infer<typeof categoryTypeSchema>;
