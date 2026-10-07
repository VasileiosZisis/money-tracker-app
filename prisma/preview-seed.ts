import { createHash } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { getLocalDateInTimeZone, isValidTimeZone } from "../lib/dates/time-zone";
import { normalizeClassificationName } from "../lib/categories/name-normalization";

export class SeedError extends Error {}
export function assertPreviewTarget(value: string | undefined) {
  let url: URL;
  try { url = new URL(value ?? ""); } catch { throw new SeedError("Missing or invalid preview DATABASE_URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
    !["ep-snowy-king-agmdfwbn-pooler.c-2.eu-central-1.aws.neon.tech", "ep-snowy-king-agmdfwbn.c-2.eu-central-1.aws.neon.tech"].includes(url.hostname) ||
    url.pathname !== "/previewdb" || decodeURIComponent(url.username) !== "preview_owner" ||
    (url.port && url.port !== "5432") || [...url.searchParams.keys()].some(k => !["sslmode", "channel_binding"].includes(k))) throw new SeedError("Seed requires the known Neon preview endpoint, previewdb and preview_owner");
}
type SeedAccount = { id: string; currency: string; timeZone: string | null; hasCompletedSetup: boolean };
export function requireSeedAccount(user: SeedAccount | null): asserts user is SeedAccount & { timeZone: string } {
  if (!user) throw new SeedError("Sign in to the preview app with this Google account first");
  if (!user.hasCompletedSetup || !user.timeZone || !isValidTimeZone(user.timeZone)) throw new SeedError("Complete preview account currency/time-zone setup first");
}
const structuralFields = ["userId", "categoryId", "subcategoryId", "type", "plannedBillId", "plannedIncomeId", "month", "transactionId", "status", "paymentSource", "localDate"] as const;
export async function insertMissing<T extends { id: string }>(rows: T[], read: () => Promise<{ id: string }[]>, create: (rows: T[]) => Promise<{ count: number }>) {
  const existing = new Map((await read()).map(row => [row.id, row]));
  for (const row of rows) {
    const stored = existing.get(row.id);
    if (!stored) continue;
    for (const key of structuralFields) {
      if (key in row && (row as Record<string, unknown>)[key] !== (stored as Record<string, unknown>)[key]) throw new SeedError(`Sample record conflict (${key}); existing records were preserved`);
    }
  }
  const missing = rows.filter(row => !existing.has(row.id));
  const inserted = missing.length ? (await create(missing)).count : 0;
  if (inserted !== missing.length) throw new SeedError("Sample insertion count mismatch");
  return { inserted, skipped: rows.length - missing.length };
}

export function inheritGeneratedMetadata(data: ReturnType<typeof buildPreviewData>, templates: { id: string; source: string | null; note: string | null }[]) {
  const byId = new Map(templates.map(template => [template.id, template]));
  for (const occurrence of [...data.billOccurrences, ...data.incomeOccurrences]) {
    if (occurrence.paymentSource !== "GENERATED") continue;
    const templateId = "plannedBillId" in occurrence ? occurrence.plannedBillId : occurrence.plannedIncomeId;
    const template = byId.get(templateId);
    const transaction = data.transactions.find(row => row.id === occurrence.transactionId);
    if (!template || !transaction) throw new SeedError("Generated sample relationship missing");
    transaction.source = template.source;
    transaction.note = template.note;
  }
}

export function buildPreviewData(user: SeedAccount, now: Date) {
  requireSeedAccount(user);
  const today = getLocalDateInTimeZone(user.timeZone, now);
  const current = today.slice(0, 7);
  const [year, month] = current.split("-").map(Number);
  const months = Array.from({ length: 25 }, (_, i) => new Date(Date.UTC(year, month - 1 - 24 + i, 1)).toISOString().slice(0, 7));
  // Existing actions require CUID-shaped IDs; keep deterministic IDs compatible.
  const id = (key: string) => `c${createHash("sha256").update(`${user.id}:preview-sample:v1:${key}`).digest("hex").slice(0, 24)}`;
  const createdAt = new Date(`${months[0]}-01T00:00:00Z`);
  const amount = (value: string) => new Prisma.Decimal(value);
  const specs = [["salary", "INCOME"], ["freelance", "INCOME"], ["housing", "EXPENSE"], ["utilities", "EXPENSE"], ["groceries", "EXPENSE"], ["transport", "EXPENSE"], ["leisure", "EXPENSE"], ["travel", "EXPENSE"]] as const;
  const categories = specs.map(([key, type]) => ({ id: id(`category:${key}`), userId: user.id, name: normalizeClassificationName(`Sample ${key}`), type, createdAt }));
  const subcategories = specs.map(([key]) => ({ id: id(`subcategory:${key}`), categoryId: id(`category:${key}`), name: "Sample regular", createdAt }));
  const classification = (key: string) => ({ categoryId: id(`category:${key}`), subcategoryId: id(`subcategory:${key}`) });
  const metadata = (key: string) => ({ source: `Fictional ${key}`, note: "Fictional preview sample data" });
  const bills = [
    { id: id("bill:rent"), userId: user.id, name: "Sample rent", amount: amount("850.00"), dueDayOfMonth: 2, ...classification("housing"), ...metadata("housing"), createdAt, isActive: true },
    { id: id("bill:utilities"), userId: user.id, name: "Sample utilities", amount: amount("120.00"), dueDayOfMonth: 14, ...classification("utilities"), ...metadata("utilities"), createdAt, isActive: true },
    { id: id("bill:membership"), userId: user.id, name: "Sample inactive membership", amount: amount("25.00"), dueDayOfMonth: 20, ...classification("leisure"), ...metadata("leisure"), createdAt, isActive: false },
  ];
  const incomes = [
    { id: id("income:salary"), userId: user.id, name: "Sample salary", amount: amount("2600.00"), expectedDayOfMonth: 1, ...classification("salary"), ...metadata("salary"), createdAt },
    { id: id("income:freelance"), userId: user.id, name: "Sample freelance", amount: amount("350.00"), expectedDayOfMonth: 24, ...classification("freelance"), ...metadata("freelance"), createdAt },
  ];
  const transactions: (Prisma.TransactionUncheckedCreateInput & { id: string })[] = [];
  const billOccurrences: (Prisma.PlannedBillOccurrenceUncheckedCreateInput & { id: string })[] = [];
  const incomeOccurrences: (Prisma.PlannedIncomeOccurrenceUncheckedCreateInput & { id: string })[] = [];
  function addTransaction(key: string, category: string, type: "INCOME" | "EXPENSE", value: Prisma.Decimal, date: string) {
    const transactionId = id(`transaction:${key}`);
    transactions.push({ id: transactionId, userId: user.id, type, amount: value, localDate: date, ...classification(category), ...metadata(category), createdAt: new Date(`${date}T12:00:00Z`) });
    return transactionId;
  }
  for (const monthKey of months) {
    const index = Number(monthKey.slice(0, 4)) * 12 + Number(monthKey.slice(5));
    const isCurrent = monthKey === current;
    for (const [key, day, base] of [["groceries", 4, "65.40"], ["groceries", 11, "72.35"], ["groceries", 19, "83.20"], ["groceries", 26, "69.80"], ["transport", 6, "48.00"], ["leisure", 16, "95.50"], ["travel", 22, "160.00"]] as const) {
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      if (date <= today) addTransaction(`${monthKey}:${key}:${day}`, key, "EXPENSE", amount(base).mul(new Prisma.Decimal(90 + index % 23).div(100)).toDecimalPlaces(2), date);
    }
    for (const [template, key] of [[bills[0], "housing"], [bills[1], "utilities"]] as const) {
      if (isCurrent) continue;
      const date = `${monthKey}-${String(template.dueDayOfMonth).padStart(2, "0")}`;
      const skipped = key === "utilities" && index % 11 === 0;
      const paymentSource = index % 2 ? "GENERATED" as const : "LINKED" as const;
      const transactionId = skipped ? null : addTransaction(`${monthKey}:bill:${key}`, key, "EXPENSE", template.amount, date);
      billOccurrences.push({ id: id(`billOccurrence:${monthKey}:${key}`), userId: user.id, plannedBillId: template.id, month: monthKey, status: skipped ? "SKIPPED" : "PAID", transactionId, paymentSource: skipped ? null : paymentSource, paidAtLocalDate: skipped ? null : date });
    }
    for (const [template, key] of [[incomes[0], "salary"], [incomes[1], "freelance"]] as const) {
      const date = `${monthKey}-${String(template.expectedDayOfMonth).padStart(2, "0")}`;
      if (date > today || (isCurrent && key === "freelance")) continue;
      const skipped = key === "freelance" && index % 5 === 0;
      const paymentSource = index % 2 ? "LINKED" as const : "GENERATED" as const;
      const value = key === "salary" ? amount("2600.00").add(new Prisma.Decimal(index % 4).mul("50.00")) : template.amount;
      const transactionId = skipped ? null : addTransaction(`${monthKey}:income:${key}`, key, "INCOME", value, date);
      incomeOccurrences.push({ id: id(`incomeOccurrence:${monthKey}:${key}`), userId: user.id, plannedIncomeId: template.id, month: monthKey, status: skipped ? "SKIPPED" : "RECEIVED", transactionId, paymentSource: skipped ? null : paymentSource, receivedAtLocalDate: skipped ? null : date });
    }
  }
  const adjustments = [{ id: id("adjustment:opening"), userId: user.id, amount: amount("1500.00"), effectiveMonth: months[0], note: "Fictional sample opening balance" }];
  return { months, categories, subcategories, bills, incomes, transactions, billOccurrences, incomeOccurrences, adjustments };
}
