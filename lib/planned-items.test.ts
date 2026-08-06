import assert from "node:assert/strict";
import test from "node:test";

import { getGeneratedTransactionMetadata } from "@/lib/planned-items";
import {
  plannedBillInputSchema,
  updatePlannedBillSchema,
} from "@/lib/validators/planned-bill";
import {
  plannedIncomeInputSchema,
  updatePlannedIncomeSchema,
} from "@/lib/validators/planned-income";

const CATEGORY_ID = "ck9isq7b50000v74pkdjx0i6h";
const PLANNED_BILL_ID = "ck9isq7b50001v74pkdjx0i6h";
const PLANNED_INCOME_ID = "ck9isq7b50002v74pkdjx0i6h";

const plannedBillInput = {
  name: "Rent",
  source: "  Direct debit  ",
  note: "  Monthly apartment rent  ",
  amount: "1200.00",
  dueDayOfMonth: 1,
  categoryId: CATEGORY_ID,
  subcategoryId: "",
  isActive: true,
};

const plannedIncomeInput = {
  name: "Salary",
  source: "  Employer transfer  ",
  note: "  Monthly salary  ",
  amount: "3000.00",
  expectedDayOfMonth: 25,
  categoryId: CATEGORY_ID,
  subcategoryId: "",
  isActive: true,
};

test("planned item metadata is trimmed for bill and income inputs", () => {
  const bill = plannedBillInputSchema.parse(plannedBillInput);
  const income = plannedIncomeInputSchema.parse(plannedIncomeInput);

  assert.equal(bill.source, "Direct debit");
  assert.equal(bill.note, "Monthly apartment rent");
  assert.equal(income.source, "Employer transfer");
  assert.equal(income.note, "Monthly salary");
});

test("blank planned item metadata normalizes to undefined", () => {
  const bill = plannedBillInputSchema.parse({
    ...plannedBillInput,
    source: "  ",
    note: "",
  });
  const income = plannedIncomeInputSchema.parse({
    ...plannedIncomeInput,
    source: "",
    note: "  ",
  });

  assert.equal(bill.source, undefined);
  assert.equal(bill.note, undefined);
  assert.equal(income.source, undefined);
  assert.equal(income.note, undefined);
});

test("planned item metadata enforces transaction length limits", () => {
  for (const result of [
    plannedBillInputSchema.safeParse({
      ...plannedBillInput,
      source: "s".repeat(121),
    }),
    plannedBillInputSchema.safeParse({
      ...plannedBillInput,
      note: "n".repeat(501),
    }),
    plannedIncomeInputSchema.safeParse({
      ...plannedIncomeInput,
      source: "s".repeat(121),
    }),
    plannedIncomeInputSchema.safeParse({
      ...plannedIncomeInput,
      note: "n".repeat(501),
    }),
  ]) {
    assert.equal(result.success, false);
  }
});

test("planned item names remain required", () => {
  assert.equal(
    plannedBillInputSchema.safeParse({ ...plannedBillInput, name: "  " })
      .success,
    false,
  );
  assert.equal(
    plannedIncomeInputSchema.safeParse({ ...plannedIncomeInput, name: "" })
      .success,
    false,
  );
});

test("planned item update schemas include normalized metadata", () => {
  const bill = updatePlannedBillSchema.parse({
    ...plannedBillInput,
    id: PLANNED_BILL_ID,
  });
  const income = updatePlannedIncomeSchema.parse({
    ...plannedIncomeInput,
    id: PLANNED_INCOME_ID,
  });

  assert.equal(bill.source, "Direct debit");
  assert.equal(bill.note, "Monthly apartment rent");
  assert.equal(income.source, "Employer transfer");
  assert.equal(income.note, "Monthly salary");
});

test("generated transaction metadata never uses the planned item name", () => {
  const plannedItem = {
    name: "Rent",
    source: "Direct debit",
    note: "Monthly apartment rent",
  };
  const metadata = getGeneratedTransactionMetadata(plannedItem);

  assert.deepEqual(metadata, {
    source: "Direct debit",
    note: "Monthly apartment rent",
  });
  assert.notEqual(metadata.source, "Rent");
});

test("an occurrence note overrides the planned item note", () => {
  assert.deepEqual(
    getGeneratedTransactionMetadata(
      { source: "Employer transfer", note: "Monthly salary" },
      "Adjusted payment",
    ),
    {
      source: "Employer transfer",
      note: "Adjusted payment",
    },
  );
});

test("missing planned item metadata produces null transaction fields", () => {
  assert.deepEqual(
    getGeneratedTransactionMetadata({ source: null, note: null }),
    { source: null, note: null },
  );
});
