import { NextRequest } from "next/server";

import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import { getCurrentMonthInTimeZone } from "@/lib/dates/time-zone";
import { buildCsvForMonth } from "@/lib/export/csv";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserPreferences();

  if (!user.timeZone) {
    return Response.redirect(new URL("/setup", request.url));
  }

  const monthParam = request.nextUrl.searchParams.get("month") ?? "";
  const month = MONTH_REGEX.test(monthParam)
    ? monthParam
    : getCurrentMonthInTimeZone(user.timeZone);
  const csv = await buildCsvForMonth(month);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
