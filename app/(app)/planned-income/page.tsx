import { redirect } from "next/navigation";

import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";

export default async function PlannedIncomeRedirectPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedParams = await resolveSearchParams(searchParams);
  const legacyEdit = firstSearchParamValue(resolvedParams.edit);
  const edit = legacyEdit
    ? legacyEdit.startsWith("income:")
      ? legacyEdit
      : `income:${legacyEdit}`
    : undefined;
  let status =
    firstSearchParamValue(resolvedParams.status) === "inactive"
      ? "inactive"
      : undefined;

  if (legacyEdit && !status) {
    const plannedIncomeId = legacyEdit.startsWith("income:")
      ? legacyEdit.slice("income:".length)
      : legacyEdit;
    const userId = await getUserIdOrThrow();
    const plannedIncome = await db.plannedIncome.findFirst({
      where: { id: plannedIncomeId, userId },
      select: { isActive: true },
    });

    if (plannedIncome && !plannedIncome.isActive) {
      status = "inactive";
    }
  }

  redirect(
    buildPathWithSearchParams("/planned", {
      type: "INCOME",
      status,
      edit,
      error: firstSearchParamValue(resolvedParams.error),
      success: firstSearchParamValue(resolvedParams.success),
    }),
  );
}
