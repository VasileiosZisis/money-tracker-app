import { cache } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";

export const getSession = cache(async function getSession() {
  return getServerSession(authOptions);
});

export async function getUserIdOrThrow() {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

export const getAuthenticatedUserPreferences = cache(
  async function getAuthenticatedUserPreferences() {
    const userId = await getUserIdOrThrow();
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
  },
);
