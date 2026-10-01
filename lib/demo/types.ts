export type DemoTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  localDate: string;
  categoryId: string;
  subcategoryId: string | null;
  source: string | null;
  note: string | null;
  createdAt: string;
};

export type DemoOccurrence = {
  templateId: string;
  month: string;
  status: "PAID" | "RECEIVED" | "SKIPPED";
  transactionId: string | null;
  paymentSource: "GENERATED" | "LINKED" | null;
};

export type DemoSnapshot = {
  version: 1;
  transactions: DemoTransaction[];
  occurrences: DemoOccurrence[];
};

export type DemoSelection = {
  view: "dashboard" | "transactions" | "planned" | "insights";
  month: string;
  type: "ALL" | "INCOME" | "EXPENSE";
  categoryId: string;
  subcategoryId: string;
  period: 3 | 6 | 12;
  balanceMonths: "all" | "3" | "6" | "12";
  changeWindow: 1 | 3 | 6;
  changeMonth: string;
};

export type DemoTransactionFields = Pick<DemoTransaction,
  "type" | "amount" | "localDate" | "categoryId" | "subcategoryId" | "source" | "note">;

export type DemoCommand =
  | { kind: "calculate" }
  | { kind: "create"; fields: DemoTransactionFields }
  | { kind: "update"; id: string; fields: DemoTransactionFields }
  | { kind: "delete"; id: string }
  | { kind: "handle"; templateId: string; month: string; amount: string; localDate: string; note: string }
  | { kind: "skip" | "undo"; templateId: string; month: string }
  | { kind: "link"; templateId: string; month: string; transactionId: string };
