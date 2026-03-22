"use client";

import type * as React from "react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Filter,
  FolderOpen,
  PencilLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  createTransaction,
  deleteTransaction,
  getTransactionFormMeta,
  listTransactions,
  updateTransaction,
} from "@/actions/transactions";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMonthLabel } from "@/lib/dates/month";
import { cn } from "@/lib/utils";

type TransactionType = "INCOME" | "EXPENSE";
type TypeFilter = "ALL" | TransactionType;

type TransactionRow = Awaited<ReturnType<typeof listTransactions>>[number];
type CategoryRow = Awaited<ReturnType<typeof getTransactionFormMeta>>["categories"][number];

type TransactionFormState = {
  type: TransactionType;
  amount: string;
  localDate: string;
  categoryId: string;
  source: string;
  note: string;
};

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

function buildDefaultFormState(): TransactionFormState {
  return {
    type: "EXPENSE",
    amount: "",
    localDate: getTodayLocalDate(),
    categoryId: "",
    source: "",
    note: "",
  };
}

function categoryLabel(category: CategoryRow | TransactionRow["category"]) {
  return `${category.name}${category.isArchived ? " (archived)" : ""}`;
}

function getSourceOrNoteSnippet(source: string | null, note: string | null) {
  if (source && source.trim().length > 0) {
    return source.trim();
  }

  if (!note || note.trim().length === 0) {
    return "No note";
  }

  const trimmed = note.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
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

function TransactionTypeToggle({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
      {(["INCOME", "EXPENSE"] as const).map((type) => {
        const active = value === type;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-card text-foreground shadow-[0_10px_26px_-18px_rgba(15,23,42,0.45)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {type === "INCOME" ? "Income" : "Expense"}
          </button>
        );
      })}
    </div>
  );
}

function TransactionForm({
  form,
  categories,
  currency,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  submitLabel,
}: {
  form: TransactionFormState;
  categories: CategoryRow[];
  currency: string;
  onChange: (nextState: TransactionFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSaving: boolean;
  submitLabel: string;
}) {
  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <TransactionTypeToggle
            value={form.type}
            onChange={(type) => onChange({ ...form, type })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="transaction-amount">Amount</Label>
          <div className="rounded-2xl border border-input bg-background/70 px-3.5 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-ring/70">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground">{currency}</span>
              <Input
                id="transaction-amount"
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => onChange({ ...form, amount: event.target.value })}
                placeholder="0.00"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="transaction-date">Date</Label>
          <Input
            id="transaction-date"
            type="date"
            value={form.localDate}
            onChange={(event) => onChange({ ...form, localDate: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="transaction-category">Category</Label>
          <Select
            id="transaction-category"
            value={form.categoryId}
            onChange={(event) => onChange({ ...form, categoryId: event.target.value })}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryLabel(category)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction-source">Source</Label>
        <Input
          id="transaction-source"
          type="text"
          value={form.source}
          onChange={(event) => onChange({ ...form, source: event.target.value })}
          placeholder="Salary, cash, bank transfer, and so on"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction-note">Note</Label>
        <Textarea
          id="transaction-note"
          value={form.note}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
          placeholder="Optional context for this entry"
          rows={4}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function TransactionSheet({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <div className="h-full w-full max-w-2xl animate-in slide-in-from-right duration-300">
          <div className="flex h-full flex-col border-l border-border/80 bg-card shadow-surface">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-2xl">
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close transaction sheet"
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}

function DeleteDialog({
  open,
  transaction,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  transaction: TransactionRow | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open || !transaction) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
        <CardHeader>
          <CardTitle>Delete transaction</CardTitle>
          <CardDescription>
            This will permanently remove the selected entry from your records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[22px] border border-border/80 bg-background/60 p-4">
            <p className="text-sm font-semibold text-foreground">
              {transaction.category.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatLocalDate(transaction.localDate)} /{" "}
              {getSourceOrNoteSnippet(transaction.source, transaction.note)}
            </p>
            <p className="mt-3 font-mono text-base font-semibold text-foreground">
              {transaction.amount}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TransactionsPage() {
  const [month, setMonth] = useState<string>(getCurrentMonthKey);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [currency, setCurrency] = useState<string>("USD");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [addForm, setAddForm] = useState<TransactionFormState>(buildDefaultFormState);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null);

  const formatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      });
    } catch {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }, [currency]);

  const categoryFilterOptions = useMemo(() => {
    if (typeFilter === "ALL") {
      return categories;
    }

    return categories.filter((category) => category.type === typeFilter);
  }, [categories, typeFilter]);

  const addFormCategoryOptions = useMemo(
    () =>
      categories.filter(
        (category) => category.type === addForm.type && category.isArchived === false,
      ),
    [categories, addForm.type],
  );

  const editFormCategoryOptions = useMemo(() => {
    if (!editForm) {
      return [];
    }

    return categories.filter(
      (category) =>
        category.type === editForm.type &&
        (category.isArchived === false || category.id === editForm.categoryId),
    );
  }, [categories, editForm]);

  const activeFilterBadges = useMemo(() => {
    const badges: string[] = [formatMonthLabel(month)];

    if (typeFilter !== "ALL") {
      badges.push(typeFilter === "INCOME" ? "Income only" : "Expense only");
    }

    if (categoryFilter) {
      const category = categories.find((item) => item.id === categoryFilter);
      if (category) {
        badges.push(categoryLabel(category));
      }
    }

    return badges;
  }, [categories, categoryFilter, month, typeFilter]);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const meta = await getTransactionFormMeta();

        if (!isActive) {
          return;
        }

        setCategories(meta.categories);
        setCurrency(meta.currency);
      } catch (metaError) {
        if (isActive) {
          setError(toErrorMessage(metaError));
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (categoryFilter.length === 0) {
      return;
    }

    const exists = categoryFilterOptions.some((category) => category.id === categoryFilter);
    if (!exists) {
      setCategoryFilter("");
    }
  }, [categoryFilter, categoryFilterOptions]);

  useEffect(() => {
    if (addFormCategoryOptions.length === 0) {
      if (addForm.categoryId !== "") {
        setAddForm((current) => ({ ...current, categoryId: "" }));
      }
      return;
    }

    const hasCurrent = addFormCategoryOptions.some(
      (category) => category.id === addForm.categoryId,
    );

    if (!hasCurrent) {
      setAddForm((current) => ({
        ...current,
        categoryId: addFormCategoryOptions[0].id,
      }));
    }
  }, [addForm.categoryId, addFormCategoryOptions]);

  useEffect(() => {
    if (!editForm) {
      return;
    }

    if (editFormCategoryOptions.length === 0) {
      if (editForm.categoryId !== "") {
        setEditForm((current) => (current ? { ...current, categoryId: "" } : current));
      }
      return;
    }

    const hasCurrent = editFormCategoryOptions.some(
      (category) => category.id === editForm.categoryId,
    );

    if (!hasCurrent) {
      setEditForm((current) =>
        current ? { ...current, categoryId: editFormCategoryOptions[0].id } : current,
      );
    }
  }, [editForm, editFormCategoryOptions]);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError("");

    void (async () => {
      try {
        const rows = await listTransactions({
          month,
          type: typeFilter === "ALL" ? undefined : typeFilter,
          categoryId: categoryFilter || undefined,
        });

        if (!isActive) {
          return;
        }

        setTransactions(rows);
      } catch (listError) {
        if (isActive) {
          setError(toErrorMessage(listError));
          setTransactions([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [month, typeFilter, categoryFilter]);

  useEffect(() => {
    const hasOverlay = isCreateOpen || Boolean(editingId) || Boolean(deleteTarget);
    if (!hasOverlay) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }

      if (editingId) {
        cancelEdit();
        return;
      }

      setIsCreateOpen(false);
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [deleteTarget, editingId, isCreateOpen]);

  async function refreshTransactions() {
    const rows = await listTransactions({
      month,
      type: typeFilter === "ALL" ? undefined : typeFilter,
      categoryId: categoryFilter || undefined,
    });
    setTransactions(rows);
  }

  function openCreateSheet() {
    setEditingId(null);
    setEditForm(null);
    setAddForm(buildDefaultFormState());
    setIsCreateOpen(true);
  }

  function closeCreateSheet() {
    setIsCreateOpen(false);
    setAddForm(buildDefaultFormState());
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await createTransaction({
        type: addForm.type,
        amount: addForm.amount,
        localDate: addForm.localDate,
        categoryId: addForm.categoryId,
        source: addForm.source,
        note: addForm.note,
      });

      await refreshTransactions();
      closeCreateSheet();
    } catch (createError) {
      setError(toErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(transaction: TransactionRow) {
    setIsCreateOpen(false);
    setEditingId(transaction.id);
    setEditForm({
      type: transaction.type as TransactionType,
      amount: transaction.amount,
      localDate: transaction.localDate,
      categoryId: transaction.categoryId,
      source: transaction.source ?? "",
      note: transaction.note ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function handleUpdateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId || !editForm || isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await updateTransaction(editingId, {
        type: editForm.type,
        amount: editForm.amount,
        localDate: editForm.localDate,
        categoryId: editForm.categoryId,
        source: editForm.source,
        note: editForm.note,
      });

      await refreshTransactions();
      cancelEdit();
    } catch (updateError) {
      setError(toErrorMessage(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTransaction() {
    if (!deleteTarget || deletingId || isSaving) {
      return;
    }

    setDeletingId(deleteTarget.id);
    setError("");

    try {
      await deleteTransaction(deleteTarget.id);
      await refreshTransactions();
      if (editingId === deleteTarget.id) {
        cancelEdit();
      }
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  function resetFilters() {
    setMonth(getCurrentMonthKey());
    setTypeFilter("ALL");
    setCategoryFilter("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Entries"
        title="Transactions"
        description="Add, edit, filter, and review manual income and expense entries without leaving the monthly context."
        actions={
          <Button onClick={openCreateSheet}>
            <Plus />
            Add transaction
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Selected month</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {formatMonthLabel(month)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Visible entries</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {isLoading ? "..." : transactions.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Current filter</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {typeFilter === "ALL" ? "All types" : typeFilter === "INCOME" ? "Income" : "Expense"}
            </p>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <CircleAlert className="size-[18px]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Something needs attention</p>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-6">
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
            <div className="space-y-2">
              <Label htmlFor="filter-month">Month</Label>
              <Input
                id="filter-month"
                type="month"
                value={month}
                onChange={(event) => {
                  if (event.target.value) {
                    setMonth(event.target.value);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-type">Type</Label>
              <Select
                id="filter-type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              >
                <option value="ALL">All types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-category">Category</Label>
              <Select
                id="filter-category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {categoryFilterOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </Select>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={resetFilters}>
              Reset filters
            </Button>

            <div className="rounded-[22px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">Context</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Archived categories stay hidden when creating new entries by default, but remain
                available when editing existing ones.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Transactions list</CardTitle>
              <CardDescription>
                Reviewing {formatMonthLabel(month)} with {transactions.length} visible{" "}
                {transactions.length === 1 ? "entry" : "entries"}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilterBadges.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="px-6 py-10 text-sm text-muted-foreground">
                Loading transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="px-6 py-6">
                <EmptyState
                  icon={FolderOpen}
                  title="No transactions match this view"
                  description="Adjust the filters or add a new entry for this month."
                  action={
                    <Button type="button" size="sm" onClick={openCreateSheet}>
                      <Plus />
                      Add transaction
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/70 lg:hidden">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="space-y-4 px-6 py-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {transaction.category.name}
                            </p>
                            <Badge
                              variant={
                                transaction.type === "INCOME" ? "success" : "destructive"
                              }
                            >
                              {transaction.type === "INCOME" ? "Income" : "Expense"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatLocalDate(transaction.localDate)}
                          </p>
                        </div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {formatter.format(Number(transaction.amount))}
                        </p>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {getSourceOrNoteSnippet(transaction.source, transaction.note)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(transaction)}
                        >
                          <PencilLine />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(transaction)}
                        >
                          <Trash2 />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border/70 text-left">
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Date
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Category
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Source / Note
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Type
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Amount
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-b border-border/70 align-top transition-colors hover:bg-background/40"
                        >
                          <td className="px-6 py-4 text-sm text-foreground">
                            {formatLocalDate(transaction.localDate)}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {categoryLabel(transaction.category)}
                          </td>
                          <td className="max-w-[320px] px-6 py-4 text-sm leading-6 text-muted-foreground">
                            {getSourceOrNoteSnippet(transaction.source, transaction.note)}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                transaction.type === "INCOME" ? "success" : "destructive"
                              }
                            >
                              {transaction.type === "INCOME" ? "Income" : "Expense"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-semibold text-foreground">
                            {formatter.format(Number(transaction.amount))}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(transaction)}
                              >
                                <PencilLine />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteTarget(transaction)}
                              >
                                <Trash2 />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <TransactionSheet
        open={isCreateOpen}
        onClose={closeCreateSheet}
        title="Add transaction"
        description="Record a new income or expense entry for the selected month."
      >
        <TransactionForm
          form={addForm}
          categories={addFormCategoryOptions}
          currency={currency}
          onChange={setAddForm}
          onSubmit={handleCreateTransaction}
          onCancel={closeCreateSheet}
          isSaving={isSaving}
          submitLabel="Save transaction"
        />
      </TransactionSheet>

      <TransactionSheet
        open={Boolean(editingId && editForm)}
        onClose={cancelEdit}
        title="Edit transaction"
        description="Update the existing entry without leaving the current review context."
      >
        {editForm ? (
          <TransactionForm
            form={editForm}
            categories={editFormCategoryOptions}
            currency={currency}
            onChange={(nextState) => setEditForm(nextState)}
            onSubmit={handleUpdateTransaction}
            onCancel={cancelEdit}
            isSaving={isSaving}
            submitLabel="Update transaction"
          />
        ) : null}
      </TransactionSheet>

      <DeleteDialog
        open={Boolean(deleteTarget)}
        transaction={deleteTarget}
        isDeleting={Boolean(deleteTarget && deletingId === deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteTransaction()}
      />
    </div>
  );
}
