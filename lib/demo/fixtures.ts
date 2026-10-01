import type { DemoSnapshot, DemoTransaction } from "./types";

export const DEMO_DATE = "2026-09-15";
export const DEMO_MONTH = "2026-09";
export const DEMO_START_MONTH = "2024-09";
export const DEMO_CURRENCY = "EUR";
export const DEMO_TIME_ZONE = "UTC";
export const DEMO_INSTANT = "2026-09-15T12:00:00.000Z";

export const demoCategories = [
  { id: "cdemosalarycategory", name: "Salary", type: "INCOME" as const, isArchived: false, subcategories: [] },
  { id: "cdemofreelancecategory", name: "Freelance", type: "INCOME" as const, isArchived: false, subcategories: [] },
  { id: "cdemohousingcategory", name: "Housing", type: "EXPENSE" as const, isArchived: false, subcategories: [] },
  { id: "cdemoutilitiescategory", name: "Utilities", type: "EXPENSE" as const, isArchived: false, subcategories: [] },
  { id: "cdemofoodcategory", name: "Food", type: "EXPENSE" as const, isArchived: false, subcategories: [
    { id: "cdemogroceriessubcategory", name: "Groceries" },
    { id: "cdemodiningubcategory", name: "Dining out" },
  ] },
  { id: "cdemotransportcategory", name: "Transport", type: "EXPENSE" as const, isArchived: false, subcategories: [] },
  { id: "cdemoleisurecategory", name: "Leisure", type: "EXPENSE" as const, isArchived: false, subcategories: [] },
];

export const demoTemplates = [
  { id: "cdemorenttemplate", name: "Rent", type: "EXPENSE" as const, amount: "900.00", day: 2, categoryId: "cdemohousingcategory", subcategoryId: null, source: "Landlord", note: "Monthly rent" },
  { id: "cdemoutilitytemplate", name: "Electricity", type: "EXPENSE" as const, amount: "85.00", day: 12, categoryId: "cdemoutilitiescategory", subcategoryId: null, source: "Electricity provider", note: "Monthly electricity" },
  { id: "cdemointernettemplate", name: "Internet", type: "EXPENSE" as const, amount: "35.00", day: 18, categoryId: "cdemoutilitiescategory", subcategoryId: null, source: "Internet provider", note: "Home internet" },
  { id: "cdemosalarytemplate", name: "Salary", type: "INCOME" as const, amount: "2800.00", day: 1, categoryId: "cdemosalarycategory", subcategoryId: null, source: "Example employer", note: "Monthly salary" },
  { id: "cdemofreelancetemplate", name: "Freelance project", type: "INCOME" as const, amount: "450.00", day: 20, categoryId: "cdemofreelancecategory", subcategoryId: null, source: "Example client", note: "Project invoice" },
];

// Each caller receives new arrays; there is no shared mutable visitor state.
export function createDemoSnapshot(): DemoSnapshot {
  const snapshot: DemoSnapshot = { version: 1, transactions: [], occurrences: [] };
  function add(month: string, day: number, categoryId: string, amount: string, suffix: string, subcategoryId: string | null = null): DemoTransaction {
    const category = demoCategories.find((item) => item.id === categoryId)!;
    const localDate = `${month}-${String(day).padStart(2, "0")}`;
    const transaction: DemoTransaction = {
      id: `cdemo${month.replace("-", "")}${suffix}`, type: category.type,
      amount, localDate, categoryId, subcategoryId, source: "Example records", note: null,
      createdAt: `${localDate}T12:00:00.000Z`,
    };
    snapshot.transactions.push(transaction);
    return transaction;
  }
  for (let index = 0; index < 24; index++) {
    const year = 2024 + Math.floor((8 + index) / 12);
    const month = `${year}-${String((8 + index) % 12 + 1).padStart(2, "0")}`;
    for (const template of demoTemplates) {
      const transaction = add(month, template.day, template.categoryId, template.amount, template.id);
      transaction.source = template.source;
      transaction.note = template.note;
      snapshot.occurrences.push({ templateId: template.id, month, status: template.type === "EXPENSE" ? "PAID" : "RECEIVED", transactionId: transaction.id, paymentSource: "GENERATED" });
    }
    // Fixture money stays decimal text; only the scenario index uses numbers.
    add(month, 7, "cdemofoodcategory", ["280.25", "295.25", "310.25", "325.25", "340.25"][index % 5], "groceries", "cdemogroceriessubcategory");
    add(month, 14, "cdemofoodcategory", ["80.50", "90.50", "100.50"][index % 3], "dining", "cdemodiningubcategory");
    add(month, 16, "cdemotransportcategory", "75.00", "transport");
    add(month, 24, "cdemoleisurecategory", index === 21 ? "850.00" : "120.00", "leisure");
  }
  for (const id of ["cdemosalarytemplate", "cdemorenttemplate"]) {
    const template = demoTemplates.find((item) => item.id === id)!;
    const transaction = add(DEMO_MONTH, template.day, template.categoryId, template.amount, template.id);
    transaction.source = template.source;
    transaction.note = template.note;
    snapshot.occurrences.push({ templateId: id, month: DEMO_MONTH, status: template.type === "EXPENSE" ? "PAID" : "RECEIVED", transactionId: transaction.id, paymentSource: "GENERATED" });
  }
  add(DEMO_MONTH, 6, "cdemofoodcategory", "135.25", "groceries", "cdemogroceriessubcategory");
  add(DEMO_MONTH, 11, "cdemofoodcategory", "42.50", "dining", "cdemodiningubcategory");
  add(DEMO_MONTH, 14, "cdemotransportcategory", "30.00", "transport");
  // An existing transaction visitors can explicitly link to electricity.
  add(DEMO_MONTH, 12, "cdemoutilitiescategory", "82.40", "electricity");
  return snapshot;
}
