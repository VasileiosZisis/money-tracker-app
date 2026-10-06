import { useState } from "react";
import { PencilLine, RotateCcw, SkipForward, WalletCards } from "lucide-react";
import { PlannedHandleForm, PlannedLinkForm } from "@/components/dashboard/planned-handling-forms";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FinancialRow } from "@/components/ui/financial-row";
import { EditorActions } from "@/components/ui/editor-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_DATE, DEMO_MONTH, demoCategories } from "@/lib/demo/fixtures";
import { DemoMonthControl, type DemoNavigate } from "./controls";
import type { DemoRun } from "./transactions";

type PlannedRow = DemoData["planned"][number];

export function DemoPlannedHandling({ item, month, busy, run, display, close, showNote = false }: {
  item: PlannedRow; month: string; busy: boolean; run: DemoRun; display: DemoData["display"]; close?: () => void; showNote?: boolean;
}) {
  const occurrence = item.occurrence;
  const handled = occurrence && occurrence.status !== "SKIPPED";
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3 border-t border-border/70">
    {!handled ? <>
      <PlannedHandleForm id={`demo-${item.id}`} type={item.type} amount={item.amount} localDate={item.defaultLocalDate} min={`${month}-01`} max={month === DEMO_MONTH ? DEMO_DATE : `${month}-${lastDay}`} disabled={busy} onSubmit={event => {
        event.preventDefault(); const values = new FormData(event.currentTarget);
        void run({ kind: "handle", templateId: item.id, month, amount: String(values.get("amount") ?? ""), localDate: String(values.get("localDate") ?? ""), note: String(values.get("note") ?? item.note ?? "") });
      }}>
        {showNote ? <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-full">Note<Textarea name="note" defaultValue={item.note} maxLength={500} disabled={busy} /></label> : null}
      </PlannedHandleForm>
      {!occurrence ? <div className="flex justify-end"><Button type="button" size="sm" variant="outline" onClick={() => void run({ kind: "skip", templateId: item.id, month })}><SkipForward data-icon="inline-start" />Skip this month</Button></div> : null}
      <PlannedLinkForm id={`demo-${item.id}`} requireChoice candidates={item.candidates.map(row => ({ id: row.id, label: `${row.localDate} - ${row.categoryName} - ${display.money[row.amount]}${row.hints.length ? ` - ${row.hints.join(', ')}` : ''}` }))} disabled={busy} onSubmit={event => {
        event.preventDefault(); void run({ kind: "link", templateId: item.id, month, transactionId: String(new FormData(event.currentTarget).get('transactionId') ?? '') });
      }} />
    </> : <p className="text-sm text-muted-foreground">{occurrence.paymentSource === "GENERATED" ? "Undo deletes the transaction created by this action." : "Undo keeps the existing transaction and removes its link."}</p>}
    {close || occurrence ? <EditorActions>{close ? <Button type="button" variant="outline" onClick={close}>Close/Cancel</Button> : null}{occurrence ? <Button type="button" variant="outline" onClick={() => void run({ kind: "undo", templateId: item.id, month })}><RotateCcw data-icon="inline-start" />Undo handling</Button> : null}</EditorActions> : null}
  </fieldset>;
}

export function DemoPlanned({ data, busy, run, navigate }: { data: DemoData; busy: boolean; run: DemoRun; navigate: DemoNavigate }) {
  const [editorId, setEditorId] = useState<string | null>(null);
  const items = data.planned.filter(item => data.selection.type === "ALL" || item.type === data.selection.type);
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-end gap-3"><DemoMonthControl selection={data.selection} busy={busy} navigate={navigate} /><label className="flex flex-col gap-1.5 text-sm font-medium">Type<Select value={data.selection.type} disabled={busy} onChange={event => void navigate({ type: event.target.value as DemoData["selection"]["type"] })}><option value="ALL">All</option><option value="EXPENSE">Bill</option><option value="INCOME">Income</option></Select></label></div>
    <Card className="overflow-hidden"><CardHeader className="border-b border-border/70 pb-4"><CardTitle>Planned items list</CardTitle></CardHeader><CardContent className="grid gap-4 p-4">
      {items.length ? items.map(item => {
        const category = demoCategories.find(category => category.id === item.categoryId)!;
        return <div key={item.id} className="rounded-xl border border-border/80 bg-background/60 p-4"><div className="flex flex-col gap-4">
          <FinancialRow planned type={item.type} category={category.name} secondary={category.subcategories.find(row => row.id === item.subcategoryId)?.name} dateLabel={`${item.type === 'EXPENSE' ? 'Due' : 'Expected'} day ${item.day}`} amount={data.display.money[item.amount]} />
          {editorId === item.id ? <>
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{item.name}</h3><Badge variant="outline">{item.status}</Badge>{item.occurrence?.paymentSource ? <Badge variant="outline">{item.occurrence.paymentSource === 'GENERATED' ? 'Created transaction' : 'Linked existing transaction'}</Badge> : null}</div>
            <DemoPlannedHandling key={`${item.id}:${data.selection.month}:${item.occurrence?.status ?? 'pending'}`} item={item} month={data.selection.month} busy={busy} run={run} display={data.display} showNote close={() => setEditorId(null)} />
          </> : <div className="flex flex-wrap gap-2"><Button size="sm" className="rounded-xl" variant="outline" disabled={busy} onClick={() => setEditorId(item.id)}><PencilLine data-icon="inline-start" />View/Edit</Button></div>}
        </div></div>;
      }) : <EmptyState icon={WalletCards} title="No planned items" />}
    </CardContent></Card>
  </div>;
}
