import { z } from "zod";

import { categoryIdSchema } from "@/lib/validators/category";

export const tagIdSchema = z.string().cuid("Invalid tag id.");

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "Tag name must be between 1 and 50 characters.")
  .max(50, "Tag name must be between 1 and 50 characters.");

export const optionalTagIdSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, tagIdSchema.optional());

export const createTagSchema = z.object({
  categoryId: categoryIdSchema,
  name: tagNameSchema,
});

export const renameTagSchema = z.object({
  id: tagIdSchema,
  name: tagNameSchema,
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type RenameTagInput = z.infer<typeof renameTagSchema>;
