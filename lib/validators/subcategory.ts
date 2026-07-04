import { z } from "zod";

import { categoryIdSchema } from "@/lib/validators/category";

export const subcategoryIdSchema = z.string().cuid("Invalid subcategory id.");

export const subcategoryNameSchema = z
  .string()
  .trim()
  .min(1, "Subcategory name must be between 1 and 50 characters.")
  .max(50, "Subcategory name must be between 1 and 50 characters.");

export const optionalSubcategoryIdSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, subcategoryIdSchema.optional());

export const createSubcategorySchema = z.object({
  categoryId: categoryIdSchema,
  name: subcategoryNameSchema,
});

export const renameSubcategorySchema = z.object({
  id: subcategoryIdSchema,
  name: subcategoryNameSchema,
});

export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type RenameSubcategoryInput = z.infer<typeof renameSubcategorySchema>;
