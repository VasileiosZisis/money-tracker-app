import { Prisma } from "@prisma/client";
import Link from "next/link";

import { getDashboardMonthData } from "@/actions/dashboard";
import { formatMonthLabel } from "@/lib/dates/month";

type DashboardPageProps = {
  searchParams?:
    | {
        month?: string | string[];
      }
    | Promise<{
    month?: string | string[];
      }>;
};

function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeMonthParam(monthParam: string | string[] | undefined): string {
  const raw = Array.isArray(monthParam) ? monthParam[0] : monthParam;

  if (!raw) {
    return getCurrentMonthKey();
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    return getCurrentMonthKey();
  }

  return raw;
}

function getNetTextClass(netLeft: Prisma.Decimal): string {
  if (netLeft.gt(0)) {
    return "text-success";
  }

  if (netLeft.lt(0)) {
    return "text-danger";
  }

  return "text-text";
}

function getSourceOrNote(source: string | null, note: string | null): string {
  if (source && source.trim().length > 0) {
    return source.trim();
  }

  if (note && note.trim().length > 0) {
    return note.trim();
  }

  return "-";
}

function formatMoney(formatter: Intl.NumberFormat, amount: Prisma.Decimal): string {
  return formatter.format(Number(amount.toString()));
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const selectedMonth = normalizeMonthParam(resolvedSearchParams?.month);
  const data = await getDashboardMonthData(selectedMonth);

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: data.currency,
  });

  return (
    <div className="space-y-6 bg-bg text-text">
      <header className="space-y-2">
        <h1 className="text-page-title">Dashboard</h1>
        <p className="text-meta text-text-2">{formatMonthLabel(selectedMonth)}</p>
      </header>

      <section className="rounded-card border border-border bg-surface p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
          <label className="space-y-1">
            <span className="text-meta text-text-2">Month</span>
            <input
              type="month"
              name="month"
              defaultValue={selectedMonth}
              className="rounded-input border border-border bg-bg px-3 py-2 text-text"
            />
          </label>
          <button
            type="submit"
            className="rounded-input bg-primary px-4 py-2 text-body text-bg hover:bg-primary-hover"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-card border border-border bg-surface p-4">
          <p className="text-meta text-text-2">Income total</p>
          <p className="mt-2 font-mono text-money text-text">
            {formatMoney(formatter, data.incomeSum)}
          </p>
        </article>

        <article className="rounded-card border border-border bg-surface p-4">
          <p className="text-meta text-text-2">Expense total</p>
          <p className="mt-2 font-mono text-money text-text">
            {formatMoney(formatter, data.expenseSum)}
          </p>
        </article>

        <article className="rounded-card border border-border bg-surface p-4">
          <p className="text-meta text-text-2">Net left</p>
          <p className={`mt-2 font-mono text-money ${getNetTextClass(data.netLeft)}`}>
            {formatMoney(formatter, data.netLeft)}
          </p>
        </article>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-section-title">Recent transactions</h2>

        {data.recentTransactions.length === 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-body text-text-2">
              No transactions for this month yet.
            </p>
            <Link
              href="/transactions"
              className="inline-flex rounded-input bg-primary px-4 py-2 text-body text-bg hover:bg-primary-hover"
            >
              Add transaction
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-meta text-text-2">Date</th>
                  <th className="pb-2 text-meta text-text-2">Category</th>
                  <th className="pb-2 text-meta text-text-2">Source / Note</th>
                  <th className="pb-2 text-meta text-text-2">Type</th>
                  <th className="pb-2 text-meta text-text-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border align-top">
                    <td className="py-3 text-body text-text">{transaction.localDate}</td>
                    <td className="py-3 text-body text-text">{transaction.category.name}</td>
                    <td className="py-3 text-body text-text-2">
                      {getSourceOrNote(transaction.source, transaction.note)}
                    </td>
                    <td className="py-3 text-body text-text">{transaction.type}</td>
                    <td className="py-3 font-mono text-money text-text">
                      {formatMoney(formatter, transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
