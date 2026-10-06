import { MonthControl } from "@/components/ui/month-control";
import type { DemoSelection } from "@/lib/demo/types";
import { DEMO_MONTH, DEMO_START_MONTH } from "@/lib/demo/fixtures";

export type DemoNavigate = (patch: Partial<DemoSelection>) => Promise<boolean>;

export function DemoMonthControl({ selection, busy, navigate, id }: { id?: string; selection: DemoSelection; busy: boolean; navigate: DemoNavigate }) {
  return <MonthControl key={selection.month} id={id ?? `demo-month-${selection.view}`} month={selection.month} min={DEMO_START_MONTH} max={DEMO_MONTH} disabled={busy} action="/demo" hiddenFields={<input type="hidden" name="view" value={selection.view} />} onSubmit={(event) => {
    event.preventDefault(); void navigate({ month: String(new FormData(event.currentTarget).get("month")) });
  }} />;
}
