import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DemoData } from "@/lib/demo/calculate";
import { DEMO_CURRENCY, DEMO_DATE, DEMO_MONTH, demoCategories } from "@/lib/demo/fixtures";
import { DemoCard, money } from "./shared";
import { DemoMonthControl, type DemoNavigate } from "./controls";
import type { DemoRun } from "./transactions";

type PlannedRow = DemoData["planned"][number];

function PlannedEditor({ item, month, busy, run, close }: { item: PlannedRow; month: string; busy: boolean; run: DemoRun; close: () => void }) {
  const occurrence = item.occurrence;
  const handled = occurrence && occurrence.status !== "SKIPPED";
  return <div className="mt-4 space-y-4">
    <div><h3 className="font-semibold">{item.name}</h3><p className="text-sm text-muted-foreground">{item.status}{occurrence?.paymentSource ? ` · ${occurrence.paymentSource === "GENERATED" ? "Created transaction" : "Linked existing transaction"}` : ""}</p></div>
    <fieldset disabled={busy} className="space-y-4">
      {!handled ? <>
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault(); const values = new FormData(event.currentTarget);
          void run({ kind: "handle", templateId: item.id, month, amount: String(values.get("amount") ?? ""), localDate: String(values.get("localDate") ?? ""), note: String(values.get("note") ?? "") });
        }}>
          <label className="grid gap-1.5 text-sm font-medium">Actual amount<CurrencyInput currency={DEMO_CURRENCY} name="amount" defaultValue={item.amount} required /></label>
          <label className="grid gap-1.5 text-sm font-medium">{item.type === "EXPENSE" ? "Payment date" : "Received date"}<Input type="date" name="localDate" defaultValue={item.defaultLocalDate} min={`${month}-01`} max={month === DEMO_MONTH ? DEMO_DATE : `${month}-${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()}`} required /></label>
          <label className="grid gap-1.5 text-sm font-medium">Note<Textarea name="note" defaultValue={item.note} maxLength={500} /></label>
          <Button type="submit" className="w-fit">{item.type === "EXPENSE" ? "Mark paid" : "Mark received"}</Button>
        </form>
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault(); const transactionId = String(new FormData(event.currentTarget).get("transactionId") ?? "");
          void run({ kind: "link", templateId: item.id, month, transactionId });
        }}>
          <label className="grid gap-1.5 text-sm font-medium">Link an existing transaction<Select name="transactionId" defaultValue="" required>
            <option value="" disabled>{item.candidates.length ? "Choose a transaction" : "No compatible transactions in this month"}</option>
            {item.candidates.map((row) => <option key={row.id} value={row.id}>{row.localDate} · {row.categoryName} · {money(row.amount)}{row.hints.length ? ` · ${row.hints.join(" / ")}` : ""}</option>)}
          </Select></label>
          <p className="text-xs text-muted-foreground">Hints describe the records. You choose which transaction to link.</p>
          <Button type="submit" variant="outline" className="w-fit" disabled={!item.candidates.length}>Link transaction</Button>
        </form>
      </> : <p className="text-sm text-muted-foreground">{occurrence.paymentSource === "GENERATED" ? "Undo deletes the transaction created by this action." : "Undo keeps the existing transaction and removes its link."}</p>}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={close}>Close/Cancel</Button>
        {!occurrence ? <Button type="button" variant="outline" onClick={() => void run({ kind: "skip", templateId: item.id, month })}>Skip this month</Button> : <Button type="button" variant="outline" onClick={() => void run({ kind: "undo", templateId: item.id, month })}>Undo handling</Button>}
      </div>
    </fieldset>
  </div>;
}

export function DemoPlanned({ data, busy, run, navigate }: { data: DemoData; busy: boolean; run: DemoRun; navigate: DemoNavigate }) {
  const [editorId, setEditorId] = useState<string | null>(null);
  const items = data.planned.filter((item) => data.selection.type === "ALL" || item.type === data.selection.type);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3"><DemoMonthControl selection={data.selection} busy={busy} navigate={navigate} /><label className="grid gap-1.5 text-sm font-medium">Type<Select value={data.selection.type} disabled={busy} onChange={(event) => void navigate({ type: event.target.value as DemoData["selection"]["type"] })}><option value="ALL">All</option><option value="EXPENSE">Bill</option><option value="INCOME">Income</option></Select></label></div>
    <p className="text-sm text-muted-foreground">Try paying, receiving, skipping, linking, and undoing the sample plans. Template and category management are available after creating your account.</p>
    <DemoCard title="Planned items">{items.map((item) => <div key={item.id} className="rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{item.type === "EXPENSE" ? "↘" : "↗"} {demoCategories.find((category) => category.id === item.categoryId)!.name}</p><div className="text-right"><p className="text-xs text-muted-foreground">{item.type === "EXPENSE" ? "Due" : "Expected"} day {item.day}</p><p className={`font-mono ${item.type === "EXPENSE" ? "text-destructive" : "text-success"}`}>{money(item.amount)}</p></div></div>
      {editorId === item.id ? <PlannedEditor key={`${item.id}:${data.selection.month}:${item.occurrence?.status ?? "pending"}`} item={item} month={data.selection.month} busy={busy} run={run} close={() => setEditorId(null)} /> : <Button variant="outline" disabled={busy} className="mt-3" onClick={() => setEditorId(item.id)}>View/Edit</Button>}
    </div>)}</DemoCard>
  </div>;
}
