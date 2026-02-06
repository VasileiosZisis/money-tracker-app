import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getUserIdOrThrow() {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}
