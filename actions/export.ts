import { getUserIdOrThrow } from "@/lib/auth/session";
import { getMonthRange } from "@/lib/dates/month";
import { db } from "@/lib/db";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatAmount(value: { toFixed: (digits: number) => string }): string {
  return value.toFixed(2);
}

export async function buildCsvForMonth(month: string): Promise<string> {
  const userId = await getUserIdOrThrow();

  if (!MONTH_REGEX.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  const { start, endExclusive } = getMonthRange(month);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      localDate: {
        gte: start,
        lt: endExclusive,
      },
    },
    orderBy: [{ localDate: "asc" }, { createdAt: "asc" }],
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  const header = "localDate,type,category,amount,source,note";

  const rows = transactions.map((transaction) => {
    const fields = [
      transaction.localDate,
      transaction.type,
      transaction.category.name,
      formatAmount(transaction.amount),
      transaction.source ?? "",
      transaction.note ?? "",
    ];

    return fields
      .map((field) => escapeCsvField(String(field)))
      .join(",");
  });

  return [header, ...rows].join("\n");
}
