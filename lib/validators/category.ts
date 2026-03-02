import { z } from "zod";

export const categoryTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Category name must be between 1 and 50 characters.")
  .max(50, "Category name must be between 1 and 50 characters.");

export const categoryIdSchema = z.string().cuid("Invalid category id.");

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  type: categoryTypeSchema,
});

export const renameCategorySchema = z.object({
  id: categoryIdSchema,
  name: categoryNameSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type RenameCategoryInput = z.infer<typeof renameCategorySchema>;
export type CategoryTypeInput = z.infer<typeof categoryTypeSchema>;
