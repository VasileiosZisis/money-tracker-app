import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderOpen,
  PencilLine,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  createTransaction,
  deleteTransaction,
  getTransactionFormMeta,
  listTransactions,
  updateTransaction,
} from "@/actions/transactions";
import { TransactionEditForm } from "@/app/(app)/transactions/transaction-edit-form";
import { TransactionFiltersDisclosure } from "@/app/(app)/transactions/transaction-filters-disclosure";
import { TransactionFormFields } from "@/app/(app)/transactions/transaction-form-fields";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastFeedback } from "@/components/ui/toast-feedback";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";
import { cn } from "@/lib/utils";

type TransactionType = "INCOME" | "EXPENSE";
type TypeFilter = "ALL" | TransactionType;

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
    timeZone: "UTC",
  }).format(date);
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
      <ToastFeedback error={errorMessage} success={successMessage} />

      <section className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Add transaction</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
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
                  singleColumn
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

          <div className="flex min-w-0 flex-col gap-4">
            <TransactionFiltersDisclosure
              key={`${selectedMonth}:${selectedType}:${effectiveCategoryFilter ?? ""}:${effectiveSubcategoryFilter ?? ""}`}
              categories={meta.categories}
              resetHref={buildTransactionsPageUrl({ month: selectedMonth })}
              selectedCategoryId={effectiveCategoryFilter}
              selectedMonth={selectedMonth}
              selectedSubcategoryId={effectiveSubcategoryFilter}
              selectedType={selectedType}
            />

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/70 pb-4">
                <CardTitle>Transactions list</CardTitle>
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
                const amountTone =
                  transaction.type === "INCOME"
                    ? "text-success"
                    : "text-destructive";
                const note = transaction.note?.trim() ?? "";

                return (
                  <div
                    key={transaction.id}
                    className="rounded-xl border border-border/80 bg-background/60 p-4"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={cn(
                              "mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg",
                              transaction.type === "INCOME"
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {transaction.type === "INCOME" ? (
                              <TrendingUp className="size-4.5" />
                            ) : (
                              <TrendingDown className="size-4.5" />
                            )}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                {transaction.category.name}
                              </h3>
                              {transaction.category.isArchived ? (
                                <Badge variant="outline">Archived category</Badge>
                              ) : null}
                            </div>
                            {transaction.subcategory || note ? (
                              <p className="text-sm leading-6 text-muted-foreground">
                                {transaction.subcategory?.name}
                                {transaction.subcategory && note ? " / " : null}
                                {note}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end">
                          <p className="text-sm font-medium text-muted-foreground">
                            {formatLocalDate(transaction.localDate)}
                          </p>
                          <p
                            className={cn(
                              "font-mono text-base font-semibold tracking-tight",
                              amountTone,
                            )}
                          >
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
                            scroll={false}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "rounded-xl",
                            )}
                            >
                              <PencilLine />
                              View/Edit
                            </Link>
                        </div>
                      ) : null}

                      {isEditing ? (
                        <TransactionEditForm
                          id={transaction.id}
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
                          cancelHref={buildTransactionsPageUrl({
                            month: selectedMonth,
                            type: selectedType,
                            categoryId: effectiveCategoryFilter,
                            subcategoryId: effectiveSubcategoryFilter,
                          })}
                          deleteAction={deleteTransactionAction}
                          updateAction={updateTransactionAction}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
