"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  createTransaction,
  deleteTransaction,
  getTransactionFormMeta,
  listTransactions,
  updateTransaction,
} from "@/actions/transactions";
import { formatMonthLabel } from "@/lib/dates/month";

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

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getTodayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
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

function categoryLabel(category: CategoryRow): string {
  return `${category.name}${category.isArchived ? " (archived)" : ""}`;
}

function getSourceOrNoteSnippet(source: string | null, note: string | null): string {
  if (source && source.trim().length > 0) {
    return source.trim();
  }

  if (!note || note.trim().length === 0) {
    return "-";
  }

  const trimmed = note.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
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

  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [addForm, setAddForm] = useState<TransactionFormState>(buildDefaultFormState);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionFormState | null>(null);

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
        (category) => category.type === addForm.type && category.isArchived === false
      ),
    [categories, addForm.type]
  );

  const editFormCategoryOptions = useMemo(() => {
    if (!editForm) {
      return [];
    }

    return categories.filter(
      (category) =>
        category.type === editForm.type &&
        (category.isArchived === false || category.id === editForm.categoryId)
    );
  }, [categories, editForm]);

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
      (category) => category.id === addForm.categoryId
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
      (category) => category.id === editForm.categoryId
    );

    if (!hasCurrent) {
      setEditForm((current) =>
        current ? { ...current, categoryId: editFormCategoryOptions[0].id } : current
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

  async function refreshTransactions() {
    const rows = await listTransactions({
      month,
      type: typeFilter === "ALL" ? undefined : typeFilter,
      categoryId: categoryFilter || undefined,
    });
    setTransactions(rows);
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
      setIsAddOpen(false);
      setAddForm(buildDefaultFormState());
    } catch (createError) {
      setError(toErrorMessage(createError));
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(transaction: TransactionRow) {
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

  async function handleDeleteTransaction(id: string) {
    if (deletingId || isSaving) {
      return;
    }

    const shouldDelete = window.confirm("Delete this transaction?");
    if (!shouldDelete) {
      return;
    }

    setDeletingId(id);
    setError("");

    try {
      await deleteTransaction(id);
      await refreshTransactions();
      if (editingId === id) {
        cancelEdit();
      }
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 bg-bg text-text">
      <header className="space-y-2">
        <h1 className="text-page-title">Transactions</h1>
        <p className="text-body text-text-2">{formatMonthLabel(month)}</p>
      </header>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-section-title">Filters</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-meta text-text-2">Month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) {
                  setMonth(event.target.value);
                }
              }}
              className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
            />
          </label>

          <label className="space-y-1">
            <span className="text-meta text-text-2">Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
            >
              <option value="ALL">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-meta text-text-2">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
            >
              <option value="">All categories</option>
              {categoryFilterOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-section-title">Add transaction</h2>
          <button
            type="button"
            onClick={() => setIsAddOpen((open) => !open)}
            className="rounded-input bg-primary px-4 py-2 text-body text-bg hover:bg-primary-hover"
          >
            {isAddOpen ? "Close" : "Add transaction"}
          </button>
        </div>

        {isAddOpen ? (
          <form className="mt-4 grid gap-3" onSubmit={handleCreateTransaction}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-meta text-text-2">Type</span>
                <select
                  value={addForm.type}
                  onChange={(event) =>
                    setAddForm((current) => ({
                      ...current,
                      type: event.target.value as TransactionType,
                    }))
                  }
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
                >
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-meta text-text-2">Amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={addForm.amount}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 font-mono text-money text-text"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-meta text-text-2">Date</span>
                <input
                  type="date"
                  value={addForm.localDate}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, localDate: event.target.value }))
                  }
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
                />
              </label>

              <label className="space-y-1">
                <span className="text-meta text-text-2">Category</span>
                <select
                  value={addForm.categoryId}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
                >
                  <option value="">Select category</option>
                  {addFormCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-meta text-text-2">Source (optional)</span>
              <input
                type="text"
                value={addForm.source}
                onChange={(event) =>
                  setAddForm((current) => ({ ...current, source: event.target.value }))
                }
                className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
              />
            </label>

            <label className="space-y-1">
              <span className="text-meta text-text-2">Note (optional)</span>
              <textarea
                value={addForm.note}
                onChange={(event) =>
                  setAddForm((current) => ({ ...current, note: event.target.value }))
                }
                rows={3}
                className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
              />
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-input bg-primary px-4 py-2 text-body text-bg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save transaction"}
            </button>
          </form>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-card border border-border bg-surface p-3 text-body text-text">
          {error}
        </div>
      ) : null}

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-section-title">Transactions list</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 text-meta text-text-2">Date</th>
                <th className="pb-2 text-meta text-text-2">Category</th>
                <th className="pb-2 text-meta text-text-2">Source / Note</th>
                <th className="pb-2 text-meta text-text-2">Amount</th>
                <th className="pb-2 text-meta text-text-2">Type</th>
                <th className="pb-2 text-meta text-text-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-body text-text-2">
                    Loading transactions...
                  </td>
                </tr>
              ) : null}

              {!isLoading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-body text-text-2">
                    No transactions for this month yet.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border align-top">
                      <td className="py-3 text-body text-text">{transaction.localDate}</td>
                      <td className="py-3 text-body text-text">
                        {categoryLabel(transaction.category)}
                      </td>
                      <td className="py-3 text-body text-text-2">
                        {getSourceOrNoteSnippet(transaction.source, transaction.note)}
                      </td>
                      <td className="py-3 font-mono text-money text-text">
                        {formatter.format(Number(transaction.amount))}
                      </td>
                      <td className="py-3">
                        <span className="rounded-input border border-border bg-bg px-2 py-1 text-meta text-text">
                          {transaction.type}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(transaction)}
                            className="rounded-input border border-border bg-bg px-3 py-1 text-meta text-text"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTransaction(transaction.id)}
                            disabled={deletingId === transaction.id}
                            className="rounded-input border border-border bg-bg px-3 py-1 text-meta text-text disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === transaction.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {editingId && editForm ? (
        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-section-title">Edit transaction</h2>
          <form className="mt-4 grid gap-3" onSubmit={handleUpdateTransaction}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-meta text-text-2">Type</span>
                <select
                  value={editForm.type}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            type: event.target.value as TransactionType,
                          }
                        : current
                    )
                  }
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
                >
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-meta text-text-2">Amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editForm.amount}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, amount: event.target.value } : current
                    )
                  }
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 font-mono text-money text-text"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-meta text-text-2">Date</span>
                <input
                  type="date"
                  value={editForm.localDate}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, localDate: event.target.value } : current
                    )
                  }
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
                />
              </label>

              <label className="space-y-1">
                <span className="text-meta text-text-2">Category</span>
                <select
                  value={editForm.categoryId}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, categoryId: event.target.value } : current
                    )
                  }
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
                >
                  <option value="">Select category</option>
                  {editFormCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-meta text-text-2">Source (optional)</span>
              <input
                type="text"
                value={editForm.source}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, source: event.target.value } : current
                  )
                }
                className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
              />
            </label>

            <label className="space-y-1">
              <span className="text-meta text-text-2">Note (optional)</span>
              <textarea
                value={editForm.note}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, note: event.target.value } : current
                  )
                }
                rows={3}
                className="w-full rounded-input border border-border bg-bg px-3 py-2 text-body text-text"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-input bg-primary px-4 py-2 text-body text-bg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Update transaction"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSaving}
                className="rounded-input border border-border bg-bg px-4 py-2 text-body text-text disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
