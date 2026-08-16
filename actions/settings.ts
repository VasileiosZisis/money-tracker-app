"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionSuccess,
  type ActionResult,
} from "@/lib/actions/result";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { timeZoneSchema } from "@/lib/validators/setup";

export async function updateAccountTimeZone(
  timeZone: string,
): Promise<ActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = timeZoneSchema.safeParse(timeZone);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid time zone.");
  }

  try {
    const updated = await db.user.updateMany({
      where: { id: userId },
      data: { timeZone: parsed.data },
    });

    if (updated.count === 0) {
      return actionError("Account not found.");
    }
  } catch {
    return actionError("Could not update your time zone. Please try again.");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/import");
  revalidatePath("/export");
  return actionSuccess();
}
