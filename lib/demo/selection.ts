import { DEMO_MONTH, DEMO_START_MONTH, demoCategories } from "./fixtures";
import type { DemoSelection } from "./types";

export const defaultDemoSelection: DemoSelection = {
  view: "dashboard", month: DEMO_MONTH, type: "ALL", categoryId: "", subcategoryId: "",
  period: 6, balanceMonths: "all", changeWindow: 3, changeMonth: "",
};

export function normalizeDemoSelection(input: Partial<Record<keyof DemoSelection, unknown>>): DemoSelection {
  const view = input.view === "transactions" || input.view === "planned" || input.view === "insights" ? input.view : "dashboard";
  const type = input.type === "INCOME" || input.type === "EXPENSE" ? input.type : "ALL";
  const month = typeof input.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) && input.month >= DEMO_START_MONTH && input.month <= DEMO_MONTH ? input.month : DEMO_MONTH;
  const category = demoCategories.find((item) => item.id === input.categoryId && (view === "insights" ? item.type === "EXPENSE" : type === "ALL" || item.type === type));
  const subcategoryId = category?.subcategories.find((item) => item.id === input.subcategoryId)?.id ?? "";
  return {
    view, month, type, categoryId: category?.id ?? "", subcategoryId,
    period: input.period === 3 || input.period === "3" ? 3 : input.period === 12 || input.period === "12" ? 12 : 6,
    balanceMonths: input.balanceMonths === "3" || input.balanceMonths === "6" || input.balanceMonths === "12" ? input.balanceMonths : "all",
    changeWindow: input.changeWindow === 1 || input.changeWindow === "1" ? 1 : input.changeWindow === 6 || input.changeWindow === "6" ? 6 : 3,
    changeMonth: typeof input.changeMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(input.changeMonth) && input.changeMonth > DEMO_START_MONTH && input.changeMonth < DEMO_MONTH ? input.changeMonth : "",
  };
}

export function demoHref(selection: DemoSelection, patch: Partial<DemoSelection> = {}) {
  const next = normalizeDemoSelection({ ...selection, ...patch });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value !== "" && value !== defaultDemoSelection[key as keyof DemoSelection]) params.set(key, String(value));
  }
  return `/demo${params.size ? `?${params}` : ""}`;
}
