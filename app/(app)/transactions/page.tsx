import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, PencilLine, Plus, Trash2 } from "lucide-react";

import {
  createTransaction,
  deleteTransaction,
  getTransactionFormMeta,
  listTransactions,
  updateTransaction,
} from "@/actions/transactions";
import { TransactionFormFields } from "@/app/(app)/transactions/transaction-form-fields";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageNotice } from "@/components/ui/page-notice";
import { Select } from "@/components/ui/select";
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
  subcategoryId?: string;
  edit?: string;
  error?: string;
  success?: string;
}) {
  return buildPathWithSearchParams("/transactions", {
    month: params.month,
    type: params.type && params.type !== "ALL" ? params.type : undefined,
    categoryId: params.categoryId,
    subcategoryId: params.subcategoryId,
    edit: params.edit,
    error: params.error,
    success: params.success,
  });
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
  const canonicalSubcategoryId = firstSearchParamValue(resolvedSearchParams.subcategoryId);
  const legacyTagId = firstSearchParamValue(resolvedSearchParams.tagId);
  const requestedSubcategoryId = canonicalSubcategoryId ?? legacyTagId;
  const editId = firstSearchParamValue(resolvedSearchParams.edit);
  const errorMessage = firstSearchParamValue(resolvedSearchParams.error);
  const successMessage = firstSearchParamValue(resolvedSearchParams.success);

  if (!canonicalSubcategoryId && legacyTagId) {
    redirect(
      buildTransactionsPageUrl({
        month: selectedMonth,
        type: selectedType,
        categoryId: requestedCategoryId,
        subcategoryId: legacyTagId,
        edit: editId,
        error: errorMessage,
        success: successMessage,
      }),
    );
  }

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
  const subcategoryFilterOptions = effectiveCategoryFilter
    ? (meta.categories.find((category) => category.id === effectiveCategoryFilter)?.subcategories ?? []).map(
        (subcategory) => ({
          id: subcategory.id,
          name: subcategory.name,
          categoryName: null as string | null,
        }),
      )
    : categoryFilterOptions.flatMap((category) =>
        category.subcategories.map((subcategory) => ({
          id: subcategory.id,
          name: subcategory.name,
          categoryName: category.name,
        })),
      );
  const effectiveSubcategoryFilter = requestedSubcategoryId
    ? subcategoryFilterOptions.find((subcategory) => subcategory.id === requestedSubcategoryId)?.id
    : undefined;

  const transactions = await listTransactions({
    month: selectedMonth,
    type: selectedType === "ALL" ? undefined : selectedType,
    categoryId: effectiveCategoryFilter,
    subcategoryId: effectiveSubcategoryFilter,
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
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
    });

    if (!result.ok) {
      redirect(
        buildTransactionsPageUrl({
          month: selectedMonth,
          type: selectedType,
          categoryId: effectiveCategoryFilter,
          subcategoryId: effectiveSubcategoryFilter,
          error: result.error,
        }),
      );
    }

    redirect(
      buildTransactionsPageUrl({
        month: selectedMonth,
        type: selectedType,
        categoryId: effectiveCategoryFilter,
        subcategoryId: effectiveSubcategoryFilter,
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
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
    });

    if (!result.ok) {
      redirect(
        buildTransactionsPageUrl({
          month: selectedMonth,
          type: selectedType,
          categoryId: effectiveCategoryFilter,
          subcategoryId: effectiveSubcategoryFilter,
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
        subcategoryId: effectiveSubcategoryFilter,
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
          subcategoryId: effectiveSubcategoryFilter,
          error: result.error,
        }),
      );
    }

    redirect(
      buildTransactionsPageUrl({
        month: selectedMonth,
        type: selectedType,
        categoryId: effectiveCategoryFilter,
        subcategoryId: effectiveSubcategoryFilter,
        success: "Transaction deleted.",
      }),
    );
  }

  return (
    <div className="flex flex-col gap-5">
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

      <section className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-4 pb-4 flex flex-col gap-4">
              <form
                method="get"
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end"
              >
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

                <FormField htmlFor="filter-subcategory" label="Subcategory">
                  <Select
                    id="filter-subcategory"
                    name="subcategoryId"
                    defaultValue={effectiveSubcategoryFilter ?? ""}
                  >
                    <option value="">
                      {effectiveCategoryFilter ? "All subcategories in category" : "All subcategories"}
                    </option>
                    {subcategoryFilterOptions.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.categoryName ? `${subcategory.categoryName} / ${subcategory.name}` : subcategory.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 xl:flex-none">
                    Apply filters
                  </Button>
                  <Link
                    href={buildTransactionsPageUrl({ month: getCurrentMonthKey() })}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "flex-1 xl:flex-none",
                    )}
                  >
                    Reset
                  </Link>
                </div>
              </form>

            </CardContent>
          </Card>

        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Add transaction</CardTitle>
              <CardDescription>
                Record a new income or expense entry for the selected month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createTransactionAction} className="grid gap-4">
                <TransactionFormFields
                  idPrefix="create-transaction"
                  categories={activeCategories}
                  currency={meta.currency}
                  defaultValues={{
                    type: "EXPENSE",
                    amount: "",
                    localDate: getTodayLocalDate(),
                    categoryId: "",
                    subcategoryId: "",
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

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Transactions list</CardTitle>
            <CardDescription>
              Reviewing {formatMonthLabel(selectedMonth)} with {transactions.length} visible{" "}
              {transactions.length === 1 ? "entry" : "entries"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-4">
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
                    className="rounded-xl border border-border/80 bg-background/60 p-4"
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
                            {transaction.subcategory ? (
                              <Badge variant="outline">{transaction.subcategory.name}</Badge>
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
                              subcategoryId: effectiveSubcategoryFilter,
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
                        <form action={updateTransactionAction} className="grid gap-4 border-t border-border/70 pt-4">
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
                              subcategoryId: transaction.subcategoryId ?? "",
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
                                subcategoryId: effectiveSubcategoryFilter,
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
        </div>
      </section>
    </div>
  );
}
