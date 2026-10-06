import { Prisma } from "@/generated/prisma/client";
import { formatLongTermChangePercent } from "@/lib/insights/long-term-patterns";

/** Server preparation only. Display labels never go back into financial inputs. */
export function formatDisplayMoney(formatter: Intl.NumberFormat, amount: string, signed = false, preserveSmallChange = false) {
  const value = new Prisma.Decimal(amount);
  if (signed && preserveSmallChange && !value.eq(0)) {
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    if (value.abs().toDecimalPlaces(digits).eq(0)) {
      return `${value.gt(0) ? "+" : "−"}<${formatter.format(Number(new Prisma.Decimal(`1e-${digits}`).toString()))}`;
    }
  }
  return `${signed && value.gt(0) ? "+" : ""}${formatter.format(Number(value.toString()))}`;
}

export function buildMoneyPresentation(input: unknown, currency: string, preserveSmallChange = false) {
  const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });
  const money: Record<string, string> = {};
  const signedMoney: Record<string, string> = {};
  const signs: Record<string, number> = {};
  const percentages: Record<string, string> = {};
  function visit(value: unknown) {
    if (typeof value === "string" && /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) {
      for (const key of [value, String(Number(value))]) {
        money[key] = formatDisplayMoney(formatter, value);
        signedMoney[key] = formatDisplayMoney(formatter, value, true, preserveSmallChange);
        signs[key] = new Prisma.Decimal(value).comparedTo(0);
        percentages[key] = formatLongTermChangePercent(value);
      }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      // Text can resemble a number; only financial output belongs in display labels.
      for (const [key, entry] of Object.entries(value)) {
        if (!nonFinancialFields.has(key)) visit(entry);
      }
    }
  }
  visit("0");
  visit(input);
  return { money, signedMoney, signs, percentages };
}

const nonFinancialFields = new Set(["id", "templateId", "transactionId", "categoryId", "subcategoryId", "name", "categoryName", "subcategoryName", "source", "note", "localDate", "createdAt", "selection"]);

export function buildChangeBars(categories: Array<{ categoryId: string; change: string }>) {
  const maximum = Math.max(0, ...categories.map(row => Math.abs(Number(row.change))));
  return Object.fromEntries(categories.map(row => {
    const change = Number(row.change);
    return [row.categoryId, { direction: change < 0 ? -1 : change > 0 ? 1 : 0, width: maximum ? Math.abs(change) / maximum * 100 : 0 }];
  }));
}
