import "server-only";

import { isVerifiedMobileGoogleProof, type VerifiedMobileGoogleProof } from "./google-verification";
import { isMobileDatabaseId, optionalMobileRow } from "./lifecycle-store";
import type { MobileTransaction } from "./mobile-transaction";

type GoogleAccountLookup =
  | { status: "linked"; userId: string }
  | { status: "account_not_linked" }
  | { status: "invalid_proof" };

export async function findMobileGoogleAccount(
  proof: VerifiedMobileGoogleProof,
  tx: MobileTransaction,
): Promise<GoogleAccountLookup> {
  if (!isVerifiedMobileGoogleProof(proof)) return { status: "invalid_proof" };

  const account = optionalMobileRow((await tx.query<{ userId: string }>("readGoogleAccount", ["google", proof.subject])).rows);
  if (!account) return { status: "account_not_linked" };
  if (!isMobileDatabaseId(account.userId)) throw new Error("Invalid mobile Google account");
  return { status: "linked", userId: account.userId };
}
