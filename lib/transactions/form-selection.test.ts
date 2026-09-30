import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  TransactionFormFields,
  type TransactionFormDefaultValues,
} from "@/app/(app)/transactions/transaction-form-fields";
import { getTransactionFormSelection } from "@/lib/transactions/form-selection";

const categories = [
  { id: "food", name: "Food", type: "EXPENSE" as const, isArchived: false, subcategories: [{ id: "groceries", name: "Groceries" }] },
  { id: "salary", name: "Salary", type: "INCOME" as const, isArchived: false, subcategories: [{ id: "base", name: "Base salary" }] },
  { id: "old-expense", name: "Old expense", type: "EXPENSE" as const, isArchived: true, subcategories: [{ id: "old-subcategory", name: "Old subcategory" }] },
];

function renderFields(
  formCategories: typeof categories,
  defaults: Partial<TransactionFormDefaultValues> = {},
  showTypeField = true,
) {
  return renderToStaticMarkup(createElement(TransactionFormFields, {
    idPrefix: "test",
    categories: formCategories,
    currency: "USD",
    singleColumn: true,
    showTypeField,
    defaultValues: {
      type: "EXPENSE",
      amount: "12.00",
      localDate: "2026-09-30",
      categoryId: "",
      subcategoryId: "",
      source: "Cash",
      note: "Lunch",
      ...defaults,
    },
  }));
}

function selectMarkup(markup: string, name: string) {
  const match = markup.match(new RegExp(`<select\\b[^>]*name="${name}"[^>]*>[\\s\\S]*?</select>`));
  assert.ok(match, `Expected rendered ${name} select`);
  return match[0];
}

test("rendered category options follow the form's selected type", () => {
  const activeCategories = categories.filter((category) => !category.isArchived);
  const expenseSelect = selectMarkup(renderFields(activeCategories), "categoryId");
  assert.match(expenseSelect, /value="food"/);
  assert.doesNotMatch(expenseSelect, /value="salary"|value="old-expense"/);
  const incomeSelect = selectMarkup(renderFields(activeCategories, { type: "INCOME" }), "categoryId");
  assert.match(incomeSelect, /value="salary"/);
  assert.doesNotMatch(incomeSelect, /value="food"|value="old-expense"/);
});

test("rendered empty category selectors remain required with an empty selected value", () => {
  for (const type of ["EXPENSE", "INCOME"] as const) {
    const markup = renderFields([], { type });
    const categorySelect = selectMarkup(markup, "categoryId");
    assert.match(categorySelect, /required=""/);
    assert.doesNotMatch(categorySelect, /disabled=/);
    assert.match(categorySelect, /value="" selected=""/);
    assert.match(categorySelect, new RegExp(`No ${type.toLowerCase()} categories available`));
    assert.match(selectMarkup(markup, "subcategoryId"), /disabled=""/);
  }
});

test("rendered editor preserves its assigned archived category and subcategory", () => {
  const markup = renderFields(categories, {
    categoryId: "old-expense",
    subcategoryId: "old-subcategory",
  }, false);
  assert.match(markup, /name="type" value="EXPENSE"/);
  assert.match(selectMarkup(markup, "categoryId"), /value="old-expense" selected=""/);
  assert.match(selectMarkup(markup, "categoryId"), /Old expense \(archived\)/);
  assert.match(selectMarkup(markup, "subcategoryId"), /value="old-subcategory" selected=""/);
});

test("creation categories follow Expense, Income, then Expense without archived options", () => {
  const activeCategories = categories.filter((category) => !category.isArchived);

  for (const [type, expectedIds] of [
    ["EXPENSE", ["food"]],
    ["INCOME", ["salary"]],
    ["EXPENSE", ["food"]],
  ] as const) {
    const selection = getTransactionFormSelection(activeCategories, type, "", "");
    assert.deepEqual(selection.availableCategories.map((category) => category.id), expectedIds);
    assert.equal(selection.categoryId, "");
  }
});

test("switching types cannot submit a category or subcategory from the previous type", () => {
  for (const [type, categoryId, subcategoryId] of [
    ["INCOME", "food", "groceries"],
    ["EXPENSE", "salary", "base"],
  ] as const) {
    const selection = getTransactionFormSelection(categories, type, categoryId, subcategoryId);
    assert.equal(selection.categoryId, "");
    assert.equal(selection.subcategoryId, "");
    assert.deepEqual(selection.availableSubcategories, []);
  }
});

test("a type without categories has no valid category or subcategory", () => {
  const selection = getTransactionFormSelection([categories[0]], "INCOME", "food", "groceries");
  assert.deepEqual(selection.availableCategories, []);
  assert.equal(selection.categoryId, "");
  assert.equal(selection.subcategoryId, "");
});

test("edit options retain the current archived category and its subcategory", () => {
  const editCategories = categories.filter((category) => !category.isArchived || category.id === "old-expense");
  const selection = getTransactionFormSelection(editCategories, "EXPENSE", "old-expense", "old-subcategory");
  assert.equal(selection.categoryId, "old-expense");
  assert.equal(selection.subcategoryId, "old-subcategory");
  assert.deepEqual(selection.availableSubcategories, categories[2].subcategories);
});

test("subcategory choices remain scoped to the selected matching category", () => {
  const selection = getTransactionFormSelection(categories, "EXPENSE", "food", "base");
  assert.equal(selection.categoryId, "food");
  assert.equal(selection.subcategoryId, "");
  assert.deepEqual(selection.availableSubcategories, categories[0].subcategories);
});
