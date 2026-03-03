import { NextRequest } from "next/server";

import { buildCsvForMonth } from "@/actions/export";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function GET(request: NextRequest) {
  const monthParam = request.nextUrl.searchParams.get("month") ?? "";
  const month = MONTH_REGEX.test(monthParam) ? monthParam : getCurrentMonth();
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
