import Link from "next/link";
import { redirect } from "next/navigation";
import { Filter, FolderOpen, PencilLine, Plus, Trash2 } from "lucide-react";

import {
  createTransaction,
  deleteTransaction,
  getTransactionFormMeta,
  listTransactions,
  updateTransaction,
} from "@/actions/transactions";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageNotice } from "@/components/ui/page-notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMonthLabel } from "@/lib/dates/month";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";
import { cn } from "@/lib/utils";

type TransactionType = "INCOME" | "EXPENSE";
type TypeFilter = "ALL" | TransactionType;

type CategoryRow = Awaited<ReturnType<typeof getTransactionFormMeta>>["categories"][number];

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getTodayLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function normalizeMonthParam(value: string | undefined) {
  if (!value || !MONTH_REGEX.test(value)) {
    return getCurrentMonthKey();
  }

  return value;
}

function normalizeTypeFilter(value: string | undefined): TypeFilter {
  return value === "INCOME" || value === "EXPENSE" ? value : "ALL";
}

function formatLocalDate(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getSourceOrNote(source: string | null, note: string | null) {
  if (source && source.trim().length > 0) {
    return source.trim();
  }

  if (note && note.trim().length > 0) {
    return note.trim();
  }

  return "No note";
}

function formatCategoryLabel(category: CategoryRow) {
  return `${category.name}${category.isArchived ? " (archived)" : ""}`;
}

function buildTransactionsPageUrl(params: {
  month: string;
  type?: TypeFilter;
  categoryId?: string;
  edit?: string;
  error?: string;
  success?: string;
}) {
  return buildPathWithSearchParams("/transactions", {
    month: params.month,
    type: params.type && params.type !== "ALL" ? params.type : undefined,
    categoryId: params.categoryId,
    edit: params.edit,
    error: params.error,
    success: params.success,
  });
}

function TransactionFormFields({
  idPrefix,
  categories,
  currency,
  defaultValues,
  showTypeField,
}: {
  idPrefix: string;
  categories: CategoryRow[];
  currency: string;
  defaultValues: {
    type: TransactionType;
    amount: string;
    localDate: string;
    categoryId: string;
    source: string;
    note: string;
  };
  showTypeField: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {showTypeField ? (
          <FormField htmlFor={`${idPrefix}-type`} label="Type">
            <Select id={`${idPrefix}-type`} name="type" defaultValue={defaultValues.type}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </Select>
          </FormField>
        ) : (
          <input type="hidden" name="type" value={defaultValues.type} />
        )}

        <FormField htmlFor={`${idPrefix}-amount`} label="Amount">
          <CurrencyInput
            id={`${idPrefix}-amount`}
            name="amount"
            currency={currency}
            defaultValue={defaultValues.amount}
            placeholder="0.00"
            required
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField htmlFor={`${idPrefix}-date`} label="Date">
          <Input
            id={`${idPrefix}-date`}
            name="localDate"
            type="date"
            defaultValue={defaultValues.localDate}
            required
          />
        </FormField>

        <FormField htmlFor={`${idPrefix}-category`} label="Category">
          <Select
            id={`${idPrefix}-category`}
            name="categoryId"
            defaultValue={defaultValues.categoryId}
            required
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {formatCategoryLabel(category)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField htmlFor={`${idPrefix}-source`} label="Source">
        <Input
          id={`${idPrefix}-source`}
          name="source"
          type="text"
          defaultValue={defaultValues.source}
          placeholder="Salary, cash, bank transfer, and so on"
        />
      </FormField>

      <FormField htmlFor={`${idPrefix}-note`} label="Note">
        <Textarea
          id={`${idPrefix}-note`}
          name="note"
          defaultValue={defaultValues.note}
          placeholder="Optional context for this entry"
          rows={4}
        />
      </FormField>
    </>
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const selectedMonth = normalizeMonthParam(firstSearchParamValue(resolvedSearchParams.month));
  const selectedType = normalizeTypeFilter(firstSearchParamValue(resolvedSearchParams.type));
  const requestedCategoryId = firstSearchParamValue(resolvedSearchParams.categoryId);
  const editId = firstSearchParamValue(resolvedSearchParams.edit);
  const errorMessage = firstSearchParamValue(resolvedSearchParams.error);
  const successMessage = firstSearchParamValue(resolvedSearchParams.success);

  const meta = await getTransactionFormMeta();
  const activeCategories = meta.categories.filter((category) => !category.isArchived);
  const validCategoryFilter = meta.categories.some((category) => category.id === requestedCategoryId)
    ? requestedCategoryId
    : undefined;
  const categoryFilterOptions =
    selectedType === "ALL"
      ? meta.categories
      : meta.categories.filter((category) => category.type === selectedType);
  const effectiveCategoryFilter =
    validCategoryFilter &&
    categoryFilterOptions.some((category) => category.id === validCategoryFilter)
      ? validCategoryFilter
      : undefined;

  const transactions = await listTransactions({
    month: selectedMonth,
    type: selectedType === "ALL" ? undefined : selectedType,
    categoryId: effectiveCategoryFilter,
  });

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: meta.currency,
  });

  const editingTransaction =
    transactions.find((transaction) => transaction.id === editId) ?? null;
  const editCategoryOptions = editingTransaction
    ? meta.categories.filter(
        (category) =>
          category.type === editingTransaction.type &&
          (!category.isArchived || category.id === editingTransaction.categoryId),
      )
    : [];

  async function createTransactionAction(formData: FormData) {
    "use server";

    const result = await createTransaction({
      type: String(formData.get("type") ?? "") as TransactionType,
      amount: String(formData.get("amount") ?? ""),
      localDate: String(formData.get("localDate") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
    });

    if (!result.ok) {
      redirect(
        buildTransactionsPageUrl({
          month: selectedMonth,
          type: selectedType,
          categoryId: effectiveCategoryFilter,
          error: result.error,
        }),
      );
    }

    redirect(
      buildTransactionsPageUrl({
        month: selectedMonth,
        type: selectedType,
        categoryId: effectiveCategoryFilter,
        success: "Transaction created.",
      }),
    );
  }

  async function updateTransactionAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const result = await updateTransaction(id, {
      type: String(formData.get("type") ?? "") as TransactionType,
      amount: String(formData.get("amount") ?? ""),
      localDate: String(formData.get("localDate") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
    });

    if (!result.ok) {
      redirect(
        buildTransactionsPageUrl({
          month: selectedMonth,
          type: selectedType,
          categoryId: effectiveCategoryFilter,
          edit: id,
          error: result.error,
        }),
      );
    }

    redirect(
      buildTransactionsPageUrl({
        month: selectedMonth,
        type: selectedType,
        categoryId: effectiveCategoryFilter,
        success: "Transaction updated.",
      }),
    );
  }

  async function deleteTransactionAction(formData: FormData) {
    "use server";

    const result = await deleteTransaction(String(formData.get("id") ?? ""));

    if (!result.ok) {
      redirect(
        buildTransactionsPageUrl({
          month: selectedMonth,
          type: selectedType,
          categoryId: effectiveCategoryFilter,
          error: result.error,
        }),
      );
    }

    redirect(
      buildTransactionsPageUrl({
        month: selectedMonth,
        type: selectedType,
        categoryId: effectiveCategoryFilter,
        success: "Transaction deleted.",
      }),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Entries"
        title="Transactions"
        description="Add, edit, filter, and review manual income and expense entries in a simpler server-first workflow."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Selected month</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {formatMonthLabel(selectedMonth)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Visible entries</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {transactions.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Current filter</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {selectedType === "ALL"
                ? "All types"
                : selectedType === "INCOME"
                  ? "Income"
                  : "Expense"}
            </p>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? (
        <PageNotice variant="error" title="Something needs attention">
          {errorMessage}
        </PageNotice>
      ) : null}

      {!errorMessage && successMessage ? (
        <PageNotice variant="success" title="Saved">
          {successMessage}
        </PageNotice>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="size-[18px]" />
                Filters
              </CardTitle>
              <CardDescription>
                Narrow the visible list by month, type, and category.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form method="get" className="space-y-5">
                <FormField htmlFor="filter-month" label="Month">
                  <Input
                    id="filter-month"
                    type="month"
                    name="month"
                    defaultValue={selectedMonth}
                  />
                </FormField>

                <FormField htmlFor="filter-type" label="Type">
                  <Select
                    id="filter-type"
                    name="type"
                    defaultValue={selectedType === "ALL" ? "" : selectedType}
                  >
                    <option value="">All types</option>
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </Select>
                </FormField>

                <FormField htmlFor="filter-category" label="Category">
                  <Select
                    id="filter-category"
                    name="categoryId"
                    defaultValue={effectiveCategoryFilter ?? ""}
                  >
                    <option value="">All categories</option>
                    {categoryFilterOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {formatCategoryLabel(category)}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="flex-1">
                    Apply filters
                  </Button>
                  <Link
                    href={buildTransactionsPageUrl({ month: getCurrentMonthKey() })}
                    className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
                  >
                    Reset
                  </Link>
                </div>
              </form>

              <div className="rounded-[22px] border border-border/80 bg-background/60 p-4">
                <p className="text-sm font-medium text-muted-foreground">Context</p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  New entries only show active categories by default. Archived categories remain
                  editable on existing transactions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add transaction</CardTitle>
              <CardDescription>
                Record a new income or expense entry for the selected month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createTransactionAction} className="grid gap-5">
                <TransactionFormFields
                  idPrefix="create-transaction"
                  categories={activeCategories}
                  currency={meta.currency}
                  defaultValues={{
                    type: "EXPENSE",
                    amount: "",
                    localDate: getTodayLocalDate(),
                    categoryId: "",
                    source: "",
                    note: "",
                  }}
                  showTypeField
                />

                <div className="flex justify-end border-t border-border/70 pt-5">
                  <Button type="submit">
                    <Plus />
                    Save transaction
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 pb-5">
            <CardTitle>Transactions list</CardTitle>
            <CardDescription>
              Reviewing {formatMonthLabel(selectedMonth)} with {transactions.length} visible{" "}
              {transactions.length === 1 ? "entry" : "entries"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            {transactions.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No transactions match this view"
                description="Adjust the filters or add a new entry for this month."
              />
            ) : (
              transactions.map((transaction) => {
                const isEditing = editingTransaction?.id === transaction.id;

                return (
                  <div
                    key={transaction.id}
                    className="rounded-[24px] border border-border/80 bg-background/60 p-4 sm:p-5"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold tracking-tight text-foreground">
                              {transaction.category.name}
                            </h3>
                            <Badge
                              variant={
                                transaction.type === "INCOME" ? "success" : "destructive"
                              }
                            >
                              {transaction.type === "INCOME" ? "Income" : "Expense"}
                            </Badge>
                            {transaction.category.isArchived ? (
                              <Badge variant="outline">Archived category</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {formatLocalDate(transaction.localDate)} /{" "}
                            {getSourceOrNote(transaction.source, transaction.note)}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="font-mono text-lg font-semibold tracking-tight text-foreground">
                            {formatter.format(Number(transaction.amount))}
                          </p>
                        </div>
                      </div>

                      {!isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={buildTransactionsPageUrl({
                              month: selectedMonth,
                              type: selectedType,
                              categoryId: effectiveCategoryFilter,
                              edit: transaction.id,
                            })}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "rounded-xl",
                            )}
                          >
                            <PencilLine />
                            Edit
                          </Link>
                          <form action={deleteTransactionAction}>
                            <input type="hidden" name="id" value={transaction.id} />
                            <Button type="submit" variant="outline" size="sm" className="rounded-xl">
                              <Trash2 />
                              Delete
                            </Button>
                          </form>
                        </div>
                      ) : null}

                      {isEditing ? (
                        <form action={updateTransactionAction} className="grid gap-5 border-t border-border/70 pt-5">
                          <input type="hidden" name="id" value={transaction.id} />
                          <TransactionFormFields
                            idPrefix={`edit-${transaction.id}`}
                            categories={editCategoryOptions}
                            currency={meta.currency}
                            defaultValues={{
                              type: transaction.type,
                              amount: transaction.amount,
                              localDate: transaction.localDate,
                              categoryId: transaction.categoryId,
                              source: transaction.source ?? "",
                              note: transaction.note ?? "",
                            }}
                            showTypeField={false}
                          />

                          <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
                            <Link
                              href={buildTransactionsPageUrl({
                                month: selectedMonth,
                                type: selectedType,
                                categoryId: effectiveCategoryFilter,
                              })}
                              className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
                            >
                              Cancel
                            </Link>
                            <Button
                              type="submit"
                              formAction={deleteTransactionAction}
                              variant="destructive"
                              className="rounded-xl"
                            >
                              <Trash2 />
                              Delete
                            </Button>
                            <Button type="submit" className="rounded-xl">
                              Save changes
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
