import { Plus, PencilLine, Trash2, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EditorActions } from "@/components/ui/editor-actions";
import { TransactionFiltersDisclosure } from "@/app/(app)/transactions/transaction-filters-disclosure";
import { demoHref } from "@/lib/demo/selection";
import { useState } from "react";
import { TransactionFormFields, type TransactionFormDefaultValues } from "@/app/(app)/transactions/transaction-form-fields";
import { Button } from "@/components/ui/button";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_CURRENCY, DEMO_DATE, DEMO_MONTH, DEMO_START_MONTH, demoCategories } from "@/lib/demo/fixtures";
import type { DemoCommand, DemoTransaction, DemoTransactionFields } from "@/lib/demo/types";
import { TransactionSummary } from "./shared";
import { type DemoNavigate } from "./controls";

export type DemoRun = (command: DemoCommand) => Promise<boolean>;

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
  return <form className="grid gap-4 border-t border-border/70 pt-4" onChange={(event) => setDirty(JSON.stringify(fieldsFromForm(event.currentTarget)) !== JSON.stringify(original))} onSubmit={(event) => {
    event.preventDefault(); const fields = fieldsFromForm(event.currentTarget); void run({ kind: "update", id: row.id, fields }).then((ok) => { if (ok) close(); });
  }}><fieldset disabled={busy} className="flex flex-col gap-4">
    <TransactionFormFields idPrefix={`demo-edit-${row.id}`} categories={demoCategories} currency={DEMO_CURRENCY} defaultValues={defaults} showTypeField singleColumn dateMin={`${DEMO_START_MONTH}-01`} dateMax={DEMO_DATE} />
    <EditorActions><Button type="button" variant="outline" onClick={close}>Close/Cancel</Button><Button type="button" variant="destructive" onClick={() => void run({ kind: "delete", id: row.id }).then((ok) => { if (ok) close(); })}><Trash2 data-icon="inline-start" />Delete</Button><Button type="submit" disabled={!dirty}>Save changes</Button></EditorActions>
  </fieldset></form>;
}

export function DemoTransactions({ data, busy, run, navigate }: { data: DemoData; busy: boolean; run: DemoRun; navigate: DemoNavigate }) {
  const [editorId, setEditorId] = useState<string | null>(null);
  const [createVersion, setCreateVersion] = useState(0);
  const defaultDate = data.selection.month === DEMO_MONTH ? DEMO_DATE : `${data.selection.month}-01`;
  const defaults: TransactionFormDefaultValues = { type: "EXPENSE", amount: "", localDate: defaultDate, categoryId: "", subcategoryId: "", source: "", note: "" };
  return <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
    <Card className="h-fit"><CardHeader><CardTitle>Add transaction</CardTitle></CardHeader><CardContent className="pt-4"><form key={`${createVersion}:${data.selection.month}`} onSubmit={(event) => {
      event.preventDefault(); const fields = fieldsFromForm(event.currentTarget); void run({ kind: "create", fields }).then((ok) => { if (ok) setCreateVersion(value => value + 1); });
    }}><fieldset disabled={busy} className="flex flex-col gap-4"><TransactionFormFields idPrefix="demo-add" categories={demoCategories} currency={DEMO_CURRENCY} defaultValues={defaults} showTypeField singleColumn dateMin={`${DEMO_START_MONTH}-01`} dateMax={DEMO_DATE} /><div className="flex justify-end border-t border-border/70 pt-5"><Button type="submit"><Plus data-icon="inline-start" />Save transaction</Button></div></fieldset></form></CardContent></Card>
    <div className="flex min-w-0 flex-col gap-4">
      <TransactionFiltersDisclosure key={`${data.selection.month}:${data.selection.type}:${data.selection.categoryId}:${data.selection.subcategoryId}`} categories={demoCategories} resetHref={demoHref(data.selection, { type: 'ALL', categoryId: '', subcategoryId: '' })} selectedMonth={data.selection.month} selectedType={data.selection.type} selectedCategoryId={data.selection.categoryId} selectedSubcategoryId={data.selection.subcategoryId} disabled={busy} monthMin={DEMO_START_MONTH} monthMax={DEMO_MONTH} onApply={values => void navigate({ month: String(values.get('month')), type: (String(values.get('type') || 'ALL')) as typeof data.selection.type, categoryId: String(values.get('categoryId') ?? ''), subcategoryId: String(values.get('subcategoryId') ?? '') })} onReset={() => void navigate({ type: 'ALL', categoryId: '', subcategoryId: '' })} />
      <Card className="overflow-hidden"><CardHeader className="border-b border-border/70 pb-4"><CardTitle>Transactions list</CardTitle></CardHeader><CardContent className="grid gap-4 p-4">
        {data.transactions.length ? data.transactions.map(row => <div key={row.id} className="rounded-xl border border-border/80 bg-background/60 p-4"><div className="flex flex-col gap-4"><TransactionSummary row={row} display={data.display} />{editorId === row.id ? <TransactionEditor key={row.id} row={row} busy={busy} run={run} close={() => setEditorId(null)} /> : <div className="flex flex-wrap gap-2"><Button size="sm" className="rounded-xl" variant="outline" disabled={busy} onClick={() => setEditorId(row.id)}><PencilLine data-icon="inline-start" />View/Edit</Button></div>}</div></div>) : <EmptyState icon={FolderOpen} title="No transactions match this view" description="Adjust the filters or add a new entry for this month." />}
      </CardContent></Card>
    </div>
  </div>;
}
