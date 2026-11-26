import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { isVerifiedMobileGoogleProof, type VerifiedMobileGoogleProof } from "./google-verification";

type GoogleAccountLookup =
  | { status: "linked"; userId: string }
  | { status: "account_not_linked" }
  | { status: "database_unavailable" }
  | { status: "invalid_proof" };

export async function findMobileGoogleAccount(
  proof: VerifiedMobileGoogleProof,
  client: Pick<Prisma.TransactionClient, "account"> = db,
): Promise<GoogleAccountLookup> {
  if (!isVerifiedMobileGoogleProof(proof)) return { status: "invalid_proof" };

  try {
    const account = await client.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: proof.subject,
        },
      },
      select: { userId: true },
    });

    if (!account) return { status: "account_not_linked" };
    return { status: "linked", userId: account.userId };
  } catch {
    return { status: "database_unavailable" };
  }
}
