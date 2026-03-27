"use server";

import { TransactionType } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  type ActionResult,
} from "@/lib/actions/result";
import { db } from "@/lib/db";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { currencySchema } from "@/lib/validators/setup";

const defaultCategories: Array<{ name: string; type: TransactionType }> = [
  { name: "Salary", type: TransactionType.INCOME },
  { name: "Bonus", type: TransactionType.INCOME },
  { name: "Freelance", type: TransactionType.INCOME },
  { name: "Housing", type: TransactionType.EXPENSE },
  { name: "Groceries", type: TransactionType.EXPENSE },
  { name: "Transport", type: TransactionType.EXPENSE },
  { name: "Utilities", type: TransactionType.EXPENSE },
  { name: "Healthcare", type: TransactionType.EXPENSE },
  { name: "Entertainment", type: TransactionType.EXPENSE },
];

type SetupActionResult = ActionResult;

export async function setCurrency(currency: string): Promise<SetupActionResult> {
  const userId = await getUserIdOrThrow();
  const parsedCurrency = currencySchema.safeParse(currency);

  if (!parsedCurrency.success) {
    return actionError(parsedCurrency.error.issues[0]?.message ?? "Invalid currency.");
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: { currency: parsedCurrency.data },
    });
  } catch {
    return actionError("Could not save your currency. Please try again.");
  }

  revalidatePath("/setup");
  return actionSuccess();
}

export async function createDefaultCategories(): Promise<SetupActionResult> {
  const userId = await getUserIdOrThrow();

  try {
    await db.category.createMany({
      data: defaultCategories.map((category) => ({
        userId,
        name: category.name,
        type: category.type,
      })),
      skipDuplicates: true,
    });
  } catch {
    return actionError("Could not create the default categories. Please try again.");
  }

  revalidatePath("/setup");
  return actionSuccess();
}

export async function completeSetup(): Promise<SetupActionResult> {
  const userId = await getUserIdOrThrow();

  try {
    await db.user.update({
      where: { id: userId },
      data: { hasCompletedSetup: true },
    });
  } catch {
    return actionError("Could not complete setup. Please try again.");
  }

  revalidatePath("/setup");
  revalidatePath("/dashboard");
  return actionSuccess();
}
