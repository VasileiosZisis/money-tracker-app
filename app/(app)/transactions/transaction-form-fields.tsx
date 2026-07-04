"use client";

import { useMemo, useState } from "react";

import { CurrencyInput } from "@/components/ui/currency-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TransactionType = "INCOME" | "EXPENSE";

type TransactionFormCategory = {
  id: string;
  name: string;
  type: TransactionType;
  isArchived: boolean;
  subcategories: {
    id: string;
    name: string;
  }[];
};

type TransactionFormDefaultValues = {
  type: TransactionType;
  amount: string;
  localDate: string;
  categoryId: string;
  subcategoryId: string;
  source: string;
  note: string;
};

function formatCategoryLabel(category: TransactionFormCategory) {
  return `${category.name}${category.isArchived ? " (archived)" : ""}`;
}

export function TransactionFormFields({
  idPrefix,
  categories,
  currency,
  defaultValues,
  showTypeField,
}: {
  idPrefix: string;
  categories: TransactionFormCategory[];
  currency: string;
  defaultValues: TransactionFormDefaultValues;
  showTypeField: boolean;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultValues.categoryId);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(defaultValues.subcategoryId);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const availableSubcategories = useMemo(() => selectedCategory?.subcategories ?? [], [selectedCategory]);
  const hasSubcategories = availableSubcategories.length > 0;
  const resolvedSelectedSubcategoryId = availableSubcategories.some((subcategory) => subcategory.id === selectedSubcategoryId)
    ? selectedSubcategoryId
    : "";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {showTypeField ? (
          <FormField htmlFor={`${idPrefix}-type`} label="Type">
            <Select id={`${idPrefix}-type`} name="type" defaultValue={defaultValues.type}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </Select>
          </FormField>
        ) : (
          <input type="hidden" name="type" value={defaultValues.type} />
        )}

        <FormField htmlFor={`${idPrefix}-amount`} label="Amount">
          <CurrencyInput
            id={`${idPrefix}-amount`}
            name="amount"
            currency={currency}
            defaultValue={defaultValues.amount}
            placeholder="0.00"
            required
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField htmlFor={`${idPrefix}-date`} label="Date">
          <Input
            id={`${idPrefix}-date`}
            name="localDate"
            type="date"
            defaultValue={defaultValues.localDate}
            required
          />
        </FormField>

        <FormField htmlFor={`${idPrefix}-category`} label="Category">
          <Select
            id={`${idPrefix}-category`}
            name="categoryId"
            value={selectedCategoryId}
            onChange={(event) => {
              const nextCategoryId = event.target.value;
              const nextCategory = categories.find((category) => category.id === nextCategoryId) ?? null;
              const nextAvailableSubcategories = nextCategory?.subcategories ?? [];

              setSelectedCategoryId(nextCategoryId);
              setSelectedSubcategoryId((currentSubcategoryId) =>
                nextAvailableSubcategories.some((subcategory) => subcategory.id === currentSubcategoryId) ? currentSubcategoryId : "",
              );
            }}
            required
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {formatCategoryLabel(category)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField htmlFor={`${idPrefix}-subcategory`} label="Subcategory">
        <Select
          id={`${idPrefix}-subcategory`}
          name="subcategoryId"
          value={resolvedSelectedSubcategoryId}
          onChange={(event) => {
            setSelectedSubcategoryId(event.target.value);
          }}
          disabled={!selectedCategoryId || !hasSubcategories}
        >
          <option value="">
            {!selectedCategoryId
              ? "Select category first"
              : hasSubcategories
                ? "No subcategory"
                : "No subcategories for this category"}
          </option>
          {availableSubcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>
              {subcategory.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField htmlFor={`${idPrefix}-source`} label="Source">
        <Input
          id={`${idPrefix}-source`}
          name="source"
          type="text"
          defaultValue={defaultValues.source}
          placeholder="Salary, cash, bank transfer, and so on"
        />
      </FormField>

      <FormField htmlFor={`${idPrefix}-note`} label="Note">
        <Textarea
          id={`${idPrefix}-note`}
          name="note"
          defaultValue={defaultValues.note}
          placeholder="Optional context for this entry"
          rows={4}
        />
      </FormField>
    </>
  );
}
