import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import {
  buildSpendingByCategory,
  type SpendingBreakdownTransaction,
} from "@/lib/dashboard/spending-by-category";

function transaction(
  overrides: Omit<
    Partial<SpendingBreakdownTransaction>,
    "amount" | "categoryId" | "category"
  > & {
    amount: string;
    categoryId: string;
    categoryName: string;
  },
): SpendingBreakdownTransaction {
  return {
    type: overrides.type ?? "EXPENSE",
    amount: new Prisma.Decimal(overrides.amount),
    categoryId: overrides.categoryId,
    subcategoryId: overrides.subcategoryId ?? null,
    category: {
      name: overrides.categoryName,
    },
    subcategory:
      overrides.subcategoryId && overrides.subcategory
        ? overrides.subcategory
        : null,
  };
}

test("aggregates expense spending by category and subcategory with Decimal arithmetic", () => {
  const result = buildSpendingByCategory([
    transaction({
      amount: "0.10",
      categoryId: "food",
      categoryName: "Food",
      subcategoryId: "groceries",
      subcategory: { name: "Groceries" },
    }),
    transaction({
      amount: "0.20",
      categoryId: "food",
      categoryName: "Food",
      subcategoryId: "groceries",
      subcategory: { name: "Groceries" },
    }),
    transaction({
      amount: "12.50",
      categoryId: "housing",
      categoryName: "Housing",
      subcategoryId: "rent",
      subcategory: { name: "Rent" },
    }),
  ]);

  assert.deepEqual(result, [
    {
      categoryId: "housing",
      categoryName: "Housing",
      total: 12.5,
      subcategories: [
        {
          subcategoryId: "rent",
          subcategoryName: "Rent",
          total: 12.5,
        },
      ],
    },
    {
      categoryId: "food",
      categoryName: "Food",
      total: 0.3,
      subcategories: [
        {
          subcategoryId: "groceries",
          subcategoryName: "Groceries",
          total: 0.3,
        },
      ],
    },
  ]);
});

test("groups missing subcategories and excludes income transactions", () => {
  const result = buildSpendingByCategory([
    transaction({
      amount: "18.75",
      categoryId: "food",
      categoryName: "Food",
    }),
    transaction({
      type: "INCOME",
      amount: "2500.00",
      categoryId: "salary",
      categoryName: "Salary",
    }),
  ]);

  assert.deepEqual(result, [
    {
      categoryId: "food",
      categoryName: "Food",
      total: 18.75,
      subcategories: [
        {
          subcategoryId: null,
          subcategoryName: "No subcategory",
          total: 18.75,
        },
      ],
    },
  ]);
});

test("sorts equal category and subcategory totals alphabetically", () => {
  const result = buildSpendingByCategory([
    transaction({
      amount: "5.00",
      categoryId: "travel",
      categoryName: "Travel",
      subcategoryId: "train",
      subcategory: { name: "Train" },
    }),
    transaction({
      amount: "5.00",
      categoryId: "travel",
      categoryName: "Travel",
      subcategoryId: "bus",
      subcategory: { name: "Bus" },
    }),
    transaction({
      amount: "10.00",
      categoryId: "food",
      categoryName: "Food",
    }),
  ]);

  assert.deepEqual(
    result.map((category) => category.categoryName),
    ["Food", "Travel"],
  );
  assert.deepEqual(
    result[1]?.subcategories.map(
      (subcategory) => subcategory.subcategoryName,
    ),
    ["Bus", "Train"],
  );
});

test("returns an empty breakdown when there are no expense transactions", () => {
  assert.deepEqual(
    buildSpendingByCategory([
      transaction({
        type: "INCOME",
        amount: "100.00",
        categoryId: "salary",
        categoryName: "Salary",
      }),
    ]),
    [],
  );
});
