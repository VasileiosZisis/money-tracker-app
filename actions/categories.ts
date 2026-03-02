"use server";

import { Prisma, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  categoryIdSchema,
  createCategorySchema,
  renameCategorySchema,
  type CreateCategoryInput,
  type RenameCategoryInput,
} from "@/lib/validators/category";

type CategoryActionResult =
  | { ok: true }
  | { ok: false; error: string };

const duplicateCategoryError =
  "A category with this name and type already exists.";

function getMutationError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return duplicateCategoryError;
  }

  return "Could not save category. Please try again.";
}

export async function listCategories() {
  const userId = await getUserIdOrThrow();

  return db.category.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { isArchived: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = createCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category input." };
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
    return { ok: false, error: getMutationError(error) };
  }

  revalidatePath("/categories");
  return { ok: true };
}

export async function renameCategory(
  input: RenameCategoryInput,
): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = renameCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category input." };
  }

  const existingCategory = await db.category.findFirst({
    where: {
      id: parsed.data.id,
      userId,
    },
    select: { id: true },
  });

  if (!existingCategory) {
    return { ok: false, error: "Category not found." };
  }

  try {
    await db.category.update({
      where: { id: existingCategory.id },
      data: { name: parsed.data.name },
    });
  } catch (error) {
    return { ok: false, error: getMutationError(error) };
  }

  revalidatePath("/categories");
  return { ok: true };
}

export async function archiveCategory(id: string): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = categoryIdSchema.safeParse(id);

  if (!parsed.success) {
    return { ok: false, error: "Invalid category id." };
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
    return { ok: false, error: "Category not found." };
  }

  revalidatePath("/categories");
  return { ok: true };
}

export async function unarchiveCategory(
  id: string,
): Promise<CategoryActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = categoryIdSchema.safeParse(id);

  if (!parsed.success) {
    return { ok: false, error: "Invalid category id." };
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
    return { ok: false, error: "Category not found." };
  }

  revalidatePath("/categories");
  return { ok: true };
}
