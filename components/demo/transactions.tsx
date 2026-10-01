import { useState } from "react";
import { TransactionFormFields, type TransactionFormDefaultValues } from "@/app/(app)/transactions/transaction-form-fields";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_CURRENCY, DEMO_DATE, DEMO_MONTH, DEMO_START_MONTH, demoCategories } from "@/lib/demo/fixtures";
import type { DemoCommand, DemoTransaction, DemoTransactionFields } from "@/lib/demo/types";
import { DemoCard, TransactionSummary } from "./shared";
import { DemoMonthControl, type DemoNavigate } from "./controls";

export type DemoRun = (command: DemoCommand) => Promise<boolean>;

function TransactionFilters({ data, busy, navigate }: { data: DemoData; busy: boolean; navigate: DemoNavigate }) {
  const [filterType, setFilterType] = useState(data.selection.type);
  const [filterCategory, setFilterCategory] = useState(data.selection.categoryId);
  const categories = demoCategories.filter((item) => filterType === "ALL" || item.type === filterType);
  const subcategories = categories.find((item) => item.id === filterCategory)?.subcategories ?? [];
  return <DemoCard title="Transaction filters"><form onSubmit={(event) => {
    event.preventDefault(); const values = new FormData(event.currentTarget); void navigate({ type: filterType, categoryId: filterCategory, subcategoryId: String(values.get("subcategoryId") ?? "") });
  }}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3">
    <label className="grid gap-1.5 text-sm">Type<Select value={filterType} onChange={(event) => { setFilterType(event.target.value as typeof filterType); setFilterCategory(""); }}><option value="ALL">All</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></Select></label>
    <label className="grid gap-1.5 text-sm">Category<Select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label>
    <label className="grid gap-1.5 text-sm">Subcategory<Select name="subcategoryId" key={filterCategory} defaultValue={data.selection.subcategoryId}><option value="">All subcategories</option>{subcategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label>
    <div className="flex gap-2 sm:col-span-3"><Button type="submit">Apply filters</Button><Button type="button" variant="outline" onClick={() => void navigate({ type: "ALL", categoryId: "", subcategoryId: "" })}>Reset filters</Button></div>
  </fieldset></form></DemoCard>;
}

function fieldsFromForm(form: HTMLFormElement): DemoTransactionFields {
  const values = new FormData(form);
  return { type: String(values.get("type")) as DemoTransactionFields["type"], amount: String(values.get("amount") ?? ""), localDate: String(values.get("localDate") ?? ""),
    categoryId: String(values.get("categoryId") ?? ""), subcategoryId: String(values.get("subcategoryId") ?? "") || null,
    source: String(values.get("source") ?? "").trim() || null, note: String(values.get("note") ?? "").trim() || null };
}

function TransactionEditor({ row, busy, run, close }: { row: DemoTransaction; busy: boolean; run: DemoRun; close: () => void }) {
  const [dirty, setDirty] = useState(false);
  const defaults: TransactionFormDefaultValues = { ...row, subcategoryId: row.subcategoryId ?? "", source: row.source ?? "", note: row.note ?? "" };
  const original: DemoTransactionFields = { type: row.type, amount: row.amount, localDate: row.localDate, categoryId: row.categoryId, subcategoryId: row.subcategoryId, source: row.source, note: row.note };
  return <form className="mt-4" onChange={(event) => setDirty(JSON.stringify(fieldsFromForm(event.currentTarget)) !== JSON.stringify(original))} onSubmit={(event) => {
    event.preventDefault(); const fields = fieldsFromForm(event.currentTarget); void run({ kind: "update", id: row.id, fields }).then((ok) => { if (ok) close(); });
  }}><fieldset disabled={busy} className="space-y-4">
    <TransactionFormFields idPrefix={`demo-edit-${row.id}`} categories={demoCategories} currency={DEMO_CURRENCY} defaultValues={defaults} showTypeField singleColumn dateMin={`${DEMO_START_MONTH}-01`} dateMax={DEMO_DATE} />
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={close}>Close/Cancel</Button><Button type="button" variant="destructive" onClick={() => void run({ kind: "delete", id: row.id }).then((ok) => { if (ok) close(); })}>Delete</Button><Button type="submit" disabled={!dirty}>Save changes</Button></div>
  </fieldset></form>;
}

export function DemoTransactions({ data, busy, run, navigate }: { data: DemoData; busy: boolean; run: DemoRun; navigate: DemoNavigate }) {
  const [editorId, setEditorId] = useState<string | null>(null);
  const [createVersion, setCreateVersion] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const defaultDate = data.selection.month === DEMO_MONTH ? DEMO_DATE : `${data.selection.month}-01`;
  const defaults: TransactionFormDefaultValues = { type: "EXPENSE", amount: "", localDate: defaultDate, categoryId: "", subcategoryId: "", source: "", note: "" };
  return <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
    <DemoCard title="Add Transaction"><form key={`${createVersion}:${data.selection.month}`} onSubmit={(event) => {
      event.preventDefault(); const fields = fieldsFromForm(event.currentTarget); void run({ kind: "create", fields }).then((ok) => { if (ok) setCreateVersion((value) => value + 1); });
    }}><fieldset disabled={busy} className="space-y-4"><TransactionFormFields idPrefix="demo-add" categories={demoCategories} currency={DEMO_CURRENCY} defaultValues={defaults} showTypeField singleColumn dateMin={`${DEMO_START_MONTH}-01`} dateMax={DEMO_DATE} /><Button type="submit">Add transaction</Button></fieldset></form><p className="text-xs text-muted-foreground">Record dates from September 1, 2024 through the example date, September 15, 2026.</p></DemoCard>
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><DemoMonthControl selection={data.selection} busy={busy} navigate={navigate} /><Button variant="outline" disabled={busy} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>Filter</Button></div>
      {filtersOpen ? <TransactionFilters key={`${data.selection.type}:${data.selection.categoryId}:${data.selection.subcategoryId}`} data={data} busy={busy} navigate={navigate} /> : null}
      <DemoCard title="Transactions List">{data.transactions.length ? data.transactions.map((row) => <div key={row.id} className="rounded-xl border border-border p-3"><TransactionSummary row={row} />{editorId === row.id ? <TransactionEditor key={row.id} row={row} busy={busy} run={run} close={() => setEditorId(null)} /> : <Button className="mt-3" variant="outline" disabled={busy} onClick={() => setEditorId(row.id)}>View/Edit</Button>}</div>) : <p className="text-sm text-muted-foreground">No transactions match these filters. Add a transaction or reset your filters.</p>}</DemoCard>
    </div>
  </div>;
}
