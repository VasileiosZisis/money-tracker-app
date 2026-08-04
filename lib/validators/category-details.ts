import { z } from "zod";

import { buildClassificationNameLookupKey } from "@/lib/categories/name-normalization";
import {
  categoryIdSchema,
  categoryNameSchema,
} from "@/lib/validators/category";
import {
  subcategoryIdSchema,
  subcategoryNameSchema,
} from "@/lib/validators/subcategory";

const existingSubcategorySchema = z.object({
  id: subcategoryIdSchema,
  name: subcategoryNameSchema,
});

const newSubcategoryNamesSchema = z
  .array(z.string())
  .transform((names) => names.filter((name) => name.trim().length > 0))
  .pipe(z.array(subcategoryNameSchema));

export const updateCategoryDetailsSchema = z
  .object({
    id: categoryIdSchema,
    name: categoryNameSchema,
    existingSubcategories: z.array(existingSubcategorySchema),
    newSubcategoryNames: newSubcategoryNamesSchema,
    deletedSubcategoryIds: z.array(subcategoryIdSchema),
  })
  .superRefine((input, context) => {
    const retainedIds = new Set<string>();

    input.existingSubcategories.forEach((subcategory, index) => {
      if (retainedIds.has(subcategory.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each subcategory can only be submitted once.",
          path: ["existingSubcategories", index, "id"],
        });
      }

      retainedIds.add(subcategory.id);
    });

    const deletedIds = new Set<string>();

    input.deletedSubcategoryIds.forEach((id, index) => {
      if (deletedIds.has(id) || retainedIds.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each subcategory can only be submitted once.",
          path: ["deletedSubcategoryIds", index],
        });
      }

      deletedIds.add(id);
    });

    const finalNames = [
      ...input.existingSubcategories.map((subcategory) => subcategory.name),
      ...input.newSubcategoryNames,
    ];
    const seenNames = new Set<string>();

    finalNames.forEach((name, index) => {
      const lookupKey = buildClassificationNameLookupKey(name);

      if (seenNames.has(lookupKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subcategory names must be unique.",
          path: ["subcategories", index],
        });
      }

      seenNames.add(lookupKey);
    });
  });

export type UpdateCategoryDetailsInput = {
  id: string;
  name: string;
  existingSubcategories: Array<{
    id: string;
    name: string;
  }>;
  newSubcategoryNames: string[];
  deletedSubcategoryIds: string[];
};
