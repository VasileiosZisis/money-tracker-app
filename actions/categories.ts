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
  createTagSchema,
  renameTagSchema,
  tagIdSchema,
  type CreateTagInput,
  type RenameTagInput,
} from "@/lib/validators/tag";

type CategoryActionResult = ActionResult;

const duplicateCategoryError =
  "A category with this name and type already exists.";
const duplicateTagError = "A tag with this name already exists in this category.";

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
      tags: {
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

  try {
    await db.category.create({
      data: {
        userId,
        name: parsed.data.name,
        type: parsed.data.type as TransactionType,
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
    select: { id: true },
  });

  if (!existingCategory) {
    return actionError("Category not found.");
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

export async function createTag(input: CreateTagInput): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = createTagSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid tag input.");
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

  try {
    await db.tag.create({
      data: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
      },
    });
  } catch (error) {
    return actionError(getMutationError(error, duplicateTagError));
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function renameTag(input: RenameTagInput): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = renameTagSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid tag input.");
  }

  const existingTag = await db.tag.findFirst({
    where: {
      id: parsed.data.id,
      category: {
        userId,
      },
    },
    select: { id: true },
  });

  if (!existingTag) {
    return actionError("Tag not found.");
  }

  try {
    await db.tag.update({
      where: { id: existingTag.id },
      data: { name: parsed.data.name },
    });
  } catch (error) {
    return actionError(getMutationError(error, duplicateTagError));
  }

  revalidateCategoryPaths();
  return actionSuccess();
}

export async function deleteTag(id: string): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = tagIdSchema.safeParse(id);

  if (!parsed.success) {
    return actionError("Invalid tag id.");
  }

  const deleted = await db.tag.deleteMany({
    where: {
      id: parsed.data,
      category: {
        userId,
      },
    },
  });

  if (deleted.count === 0) {
    return actionError("Tag not found.");
  }

  revalidateCategoryPaths();
  return actionSuccess();
}
