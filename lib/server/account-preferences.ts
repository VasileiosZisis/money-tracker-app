import "server-only";

import { db } from "@/lib/db";

/** The caller supplies the internal user ID resolved by server-side authentication. */
export async function loadAccountPreferences(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      currency: true,
      hasCompletedSetup: true,
      timeZone: true,
    },
  });

  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    userId,
    ...user,
  };
}
