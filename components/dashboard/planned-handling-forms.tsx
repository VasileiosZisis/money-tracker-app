import type { FormEventHandler, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function PlannedHandleForm({ id, type, amount, localDate, min, max, disabled, hiddenFields, action, onSubmit, children }: {
  id: string; type: "INCOME" | "EXPENSE"; amount: string; localDate: string; min?: string; max?: string; disabled?: boolean;
  hiddenFields?: ReactNode; action?: (values: FormData) => Promise<void>; onSubmit?: FormEventHandler<HTMLFormElement>; children?: ReactNode;
}) {
  const prefix = type === "INCOME" ? "received" : "paid";
  return <form action={action} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] min-[1280px]:max-[1479px]:grid-cols-2!">
    {hiddenFields}
    <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor={`${prefix}-date-${id}`}>{type === "INCOME" ? "Received date" : "Payment date"}</label><Input disabled={disabled} key={localDate} id={`${prefix}-date-${id}`} name="localDate" type="date" defaultValue={localDate} min={min} max={max} required /></div>
    <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor={`${prefix}-amount-${id}`}>Amount</label><Input disabled={disabled} id={`${prefix}-amount-${id}`} name="amount" type="text" inputMode="decimal" defaultValue={amount} required /></div>
    <Button disabled={disabled} className="self-end min-[1280px]:max-[1479px]:col-span-2!" type="submit">{type === "INCOME" ? "Mark received" : "Mark paid"}</Button>
    {children}
  </form>;
}

export function PlannedLinkForm({ id, candidates, disabled, hiddenFields, action, onSubmit, requireChoice = false, className }: {
  id: string; candidates: Array<{ id: string; label: string }>; disabled?: boolean; hiddenFields?: ReactNode;
  action?: (values: FormData) => Promise<void>; onSubmit?: FormEventHandler<HTMLFormElement>; requireChoice?: boolean; className?: string;
}) {
  return <form action={action} onSubmit={onSubmit} className={className ?? "grid gap-3 border-t border-border/70 sm:grid-cols-[minmax(0,1fr)_auto]"}>
    {hiddenFields}<div className="flex min-w-0 flex-col gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor={`link-transaction-${id}`}>Link existing transaction</label><Select disabled={disabled || !candidates.length} id={`link-transaction-${id}`} name="transactionId" defaultValue={requireChoice ? "" : candidates[0]?.id ?? ""} required>
      {requireChoice || !candidates.length ? <option value="" disabled>{candidates.length ? "Choose a transaction" : "No compatible transactions in this month"}</option> : null}{candidates.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
    </Select></div><Button disabled={disabled || !candidates.length} type="submit" variant="outline" size="sm" className="self-end">Link transaction</Button>
  </form>;
}
