"use server";

import { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  type ActionResult,
} from "@/lib/actions/result";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  categoryIdSchema,
  createCategorySchema,
  renameCategorySchema,
  type CreateCategoryInput,
  type RenameCategoryInput,
} from "@/lib/validators/category";
import {
  createSubcategorySchema,
  renameSubcategorySchema,
  subcategoryIdSchema,
  type CreateSubcategoryInput,
  type RenameSubcategoryInput,
} from "@/lib/validators/subcategory";
import {
  updateCategoryDetailsSchema,
  type UpdateCategoryDetailsInput,
} from "@/lib/validators/category-details";

type CategoryActionResult = ActionResult;

const duplicateCategoryError =
  "A category with this name and type already exists.";
const duplicateSubcategoryError = "A subcategory with this name already exists in this category.";

class CategoryDetailsError extends Error {}

function getMutationError(error: unknown, duplicateError: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return duplicateError;
  }

  return "Could not save changes. Please try again.";
}

function revalidateCategoryPaths() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/export");
  revalidatePath("/planned");
  revalidatePath("/dashboard");
}

export async function listCategories() {
  const userId = await getUserIdOrThrow();

  return db.category.findMany({
    where: { userId },
    include: {
      subcategories: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: [{ type: "asc" }, { isArchived: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = createCategorySchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid category input.");
  }

  const subcategoryNames = parsed.data.subcategoryNames ?? [];
  const duplicateCategory = await db.category.findFirst({
    where: {
      userId,
      type: parsed.data.type as TransactionType,
      name: {
        equals: parsed.data.name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicateCategory) {
    return actionError(duplicateCategoryError);
  }

  try {
    await db.category.create({
      data: {
        userId,
        name: parsed.data.name,
        type: parsed.data.type as TransactionType,
        ...(subcategoryNames.length > 0
          ? {
              subcategories: {
                create: subcategoryNames.map((name) => ({ name })),
              },
            }
          : {}),
      },
    });
  } catch (error) {
    return actionError(getMutationError(error, duplicateCategoryError));
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function renameCategory(
  input: RenameCategoryInput,
): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = renameCategorySchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid category input.");
  }

  const existingCategory = await db.category.findFirst({
    where: {
      id: parsed.data.id,
      userId,
    },
    select: { id: true, type: true },
  });

  if (!existingCategory) {
    return actionError("Category not found.");
  }

  const duplicateCategory = await db.category.findFirst({
    where: {
      userId,
      type: existingCategory.type,
      name: {
        equals: parsed.data.name,
        mode: "insensitive",
      },
      NOT: { id: existingCategory.id },
    },
    select: { id: true },
  });

  if (duplicateCategory) {
    return actionError(duplicateCategoryError);
  }

  try {
    await db.category.update({
      where: { id: existingCategory.id },
      data: { name: parsed.data.name },
    });
  } catch (error) {
    return actionError(getMutationError(error, duplicateCategoryError));
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function updateCategoryDetails(
  input: UpdateCategoryDetailsInput,
): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = updateCategoryDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(
      parsed.error.issues[0]?.message ?? "Invalid category input.",
    );
  }

  const rawExistingNames = new Map(
    input.existingSubcategories.map((subcategory) => [
      subcategory.id,
      subcategory.name,
    ]),
  );

  try {
    await db.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: {
          id: parsed.data.id,
          userId,
        },
        select: {
          id: true,
          name: true,
          type: true,
          subcategories: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!category) {
        throw new CategoryDetailsError("Category not found.");
      }

      const submittedSubcategoryIds = new Set([
        ...parsed.data.existingSubcategories.map(
          (subcategory) => subcategory.id,
        ),
        ...parsed.data.deletedSubcategoryIds,
      ]);
      const submittedAllCurrentSubcategories =
        submittedSubcategoryIds.size === category.subcategories.length &&
        category.subcategories.every((subcategory) =>
          submittedSubcategoryIds.has(subcategory.id),
        );

      if (!submittedAllCurrentSubcategories) {
        throw new CategoryDetailsError(
          "The category changed while you were editing it. Refresh and try again.",
        );
      }

      const categoryName =
        input.name === category.name ? category.name : parsed.data.name;
      const duplicateCategory = await tx.category.findFirst({
        where: {
          userId,
          type: category.type,
          name: {
            equals: categoryName,
            mode: "insensitive",
          },
          NOT: { id: category.id },
        },
        select: { id: true },
      });

      if (duplicateCategory) {
        throw new CategoryDetailsError(duplicateCategoryError);
      }

      const currentSubcategories = new Map(
        category.subcategories.map((subcategory) => [
          subcategory.id,
          subcategory,
        ]),
      );
      const renamedSubcategories = parsed.data.existingSubcategories.filter(
        (subcategory) =>
          rawExistingNames.get(subcategory.id) !==
          currentSubcategories.get(subcategory.id)?.name,
      );

      if (parsed.data.deletedSubcategoryIds.length > 0) {
        const deleted = await tx.subcategory.deleteMany({
          where: {
            id: { in: parsed.data.deletedSubcategoryIds },
            categoryId: category.id,
            category: { userId },
          },
        });

        if (deleted.count !== parsed.data.deletedSubcategoryIds.length) {
          throw new CategoryDetailsError(
            "The category changed while you were editing it. Refresh and try again.",
          );
        }
      }

      for (const subcategory of renamedSubcategories) {
        const temporarilyRenamed = await tx.subcategory.updateMany({
          where: {
            id: subcategory.id,
            categoryId: category.id,
            category: { userId },
          },
          data: {
            name: `__category_edit_${crypto.randomUUID()}`,
          },
        });

        if (temporarilyRenamed.count !== 1) {
          throw new CategoryDetailsError(
            "The category changed while you were editing it. Refresh and try again.",
          );
        }
      }

      const updatedCategory = await tx.category.updateMany({
        where: {
          id: category.id,
          userId,
        },
        data: { name: categoryName },
      });

      if (updatedCategory.count !== 1) {
        throw new CategoryDetailsError("Category not found.");
      }

      for (const subcategory of renamedSubcategories) {
        const renamed = await tx.subcategory.updateMany({
          where: {
            id: subcategory.id,
            categoryId: category.id,
            category: { userId },
          },
          data: { name: subcategory.name },
        });

        if (renamed.count !== 1) {
          throw new CategoryDetailsError(
            "The category changed while you were editing it. Refresh and try again.",
          );
        }
      }

      for (const name of parsed.data.newSubcategoryNames) {
        await tx.subcategory.create({
          data: {
            categoryId: category.id,
            name,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof CategoryDetailsError) {
      return actionError(error.message);
    }

    return actionError(
      getMutationError(
        error,
        "A category or subcategory with that name already exists.",
      ),
    );
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function archiveCategory(id: string): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = categoryIdSchema.safeParse(id);

  if (!parsed.success) {
    return actionError("Invalid category id.");
  }

  const result = await db.category.updateMany({
    where: {
      id: parsed.data,
      userId,
    },
    data: {
      isArchived: true,
    },
  });

  if (result.count === 0) {
    return actionError("Category not found.");
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function unarchiveCategory(
  id: string,
): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = categoryIdSchema.safeParse(id);

  if (!parsed.success) {
    return actionError("Invalid category id.");
  }

  const result = await db.category.updateMany({
    where: {
      id: parsed.data,
      userId,
    },
    data: {
      isArchived: false,
    },
  });

  if (result.count === 0) {
    return actionError("Category not found.");
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function createSubcategory(input: CreateSubcategoryInput): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = createSubcategorySchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid subcategory input.");
  }

  const category = await db.category.findFirst({
    where: {
      id: parsed.data.categoryId,
      userId,
    },
    select: { id: true },
  });

  if (!category) {
    return actionError("Category not found.");
  }

  const duplicateSubcategory = await db.subcategory.findFirst({
    where: {
      categoryId: category.id,
      name: {
        equals: parsed.data.name,
        mode: "insensitive",
      },
      category: {
        userId,
      },
    },
    select: { id: true },
  });

  if (duplicateSubcategory) {
    return actionError(duplicateSubcategoryError);
  }

  try {
    await db.subcategory.create({
      data: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
      },
    });
  } catch (error) {
    return actionError(getMutationError(error, duplicateSubcategoryError));
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function renameSubcategory(input: RenameSubcategoryInput): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = renameSubcategorySchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid subcategory input.");
  }

  const existingSubcategory = await db.subcategory.findFirst({
    where: {
      id: parsed.data.id,
      category: {
        userId,
      },
    },
    select: { id: true, categoryId: true },
  });

  if (!existingSubcategory) {
    return actionError("Subcategory not found.");
  }

  const duplicateSubcategory = await db.subcategory.findFirst({
    where: {
      categoryId: existingSubcategory.categoryId,
      name: {
        equals: parsed.data.name,
        mode: "insensitive",
      },
      NOT: { id: existingSubcategory.id },
      category: {
        userId,
      },
    },
    select: { id: true },
  });

  if (duplicateSubcategory) {
    return actionError(duplicateSubcategoryError);
  }

  try {
    await db.subcategory.update({
      where: { id: existingSubcategory.id },
      data: { name: parsed.data.name },
    });
  } catch (error) {
    return actionError(getMutationError(error, duplicateSubcategoryError));
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function deleteSubcategory(id: string): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = subcategoryIdSchema.safeParse(id);

  if (!parsed.success) {
    return actionError("Invalid subcategory id.");
  }

  const deleted = await db.subcategory.deleteMany({
    where: {
      id: parsed.data,
      category: {
        userId,
      },
    },
  });

  if (deleted.count === 0) {
    return actionError("Subcategory not found.");
  }

  revalidateCategoryPaths();
  return actionSuccess();
}
