import { FinancialRow } from "@/components/ui/financial-row";
import type { MoneyPresentation } from "@/components/insights/display-money";
import { demoCategories } from "@/lib/demo/fixtures";
import type { DemoTransaction } from "@/lib/demo/types";

export function TransactionSummary({ row, display, includeNote = true }: { row: DemoTransaction; display: MoneyPresentation; includeNote?: boolean }) {
  const category = demoCategories.find(item => item.id === row.categoryId)!;
  const subcategory = category.subcategories.find(item => item.id === row.subcategoryId)?.name;
  const secondary = [subcategory, includeNote ? row.note?.trim() : null].filter(Boolean).join(" / ");
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${row.localDate}T12:00:00Z`));
  return <FinancialRow heading={includeNote ? "h3" : "p"} truncateSecondary={!includeNote} type={row.type} category={category.name} secondary={secondary} dateLabel={dateLabel} amount={display.money[row.amount]} />;
}
