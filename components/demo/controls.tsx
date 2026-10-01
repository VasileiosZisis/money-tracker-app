import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DemoSelection } from "@/lib/demo/types";
import { DEMO_MONTH, DEMO_START_MONTH } from "@/lib/demo/fixtures";

export type DemoNavigate = (patch: Partial<DemoSelection>) => Promise<boolean>;

export function DemoMonthControl({ selection, busy, navigate }: { selection: DemoSelection; busy: boolean; navigate: DemoNavigate }) {
  return <form action="/demo" method="get" onSubmit={(event) => {
    event.preventDefault(); void navigate({ month: String(new FormData(event.currentTarget).get("month")) });
  }}>
    <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="view" value={selection.view} />
      <label className="grid gap-1.5 text-sm font-medium">Month<Input key={selection.month} name="month" type="month" min={DEMO_START_MONTH} max={DEMO_MONTH} defaultValue={selection.month} required /></label>
      <Button type="submit">Apply</Button>
    </fieldset>
  </form>;
}
