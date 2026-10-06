import type { FormEventHandler, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function MonthControl({ id, month, min, max, disabled, hiddenFields, onSubmit, action }: {
  id: string; month: string; min?: string; max?: string; disabled?: boolean;
  hiddenFields?: ReactNode; onSubmit?: FormEventHandler<HTMLFormElement>; action?: string;
}) {
  return <form method="get" action={action} onSubmit={onSubmit}><fieldset disabled={disabled} className="flex flex-wrap items-end gap-3">
    {hiddenFields}<div className="flex flex-col gap-1.5"><label htmlFor={id} className="sr-only">Month</label><Input id={id} type="month" name="month" defaultValue={month} min={min} max={max} /></div><Button type="submit">Apply</Button>
  </fieldset></form>;
}
