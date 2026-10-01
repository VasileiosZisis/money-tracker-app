"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CurrencyInput } from "@/components/ui/currency-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getTransactionFormSelection } from "@/lib/transactions/form-selection";
import { cn } from "@/lib/utils";

type TransactionType = "INCOME" | "EXPENSE";

export type TransactionFormCategory = {
  id: string;
  name: string;
  type: TransactionType;
  isArchived: boolean;
  subcategories: {
    id: string;
    name: string;
  }[];
};

export type TransactionFormDefaultValues = {
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
  singleColumn = false,
  showTypeField,
  dateMin,
  dateMax,
}: {
  idPrefix: string;
  categories: TransactionFormCategory[];
  currency: string;
  defaultValues: TransactionFormDefaultValues;
  singleColumn?: boolean;
  showTypeField: boolean;
  dateMin?: string;
  dateMax?: string;
}) {
  const [selectedType, setSelectedType] = useState(defaultValues.type);
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultValues.categoryId);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(defaultValues.subcategoryId);
  const localDateInputRef = useRef<HTMLInputElement | null>(null);
  const previousDefaultLocalDateRef = useRef(defaultValues.localDate);

  useEffect(() => {
    const localDateInput = localDateInputRef.current;

    if (
      localDateInput &&
      localDateInput.value === previousDefaultLocalDateRef.current
    ) {
      localDateInput.value = defaultValues.localDate;
    }

    previousDefaultLocalDateRef.current = defaultValues.localDate;
  }, [defaultValues.localDate]);

  const selection = useMemo(
    () => getTransactionFormSelection(categories, selectedType, selectedCategoryId, selectedSubcategoryId),
    [categories, selectedType, selectedCategoryId, selectedSubcategoryId],
  );
  const { availableCategories, availableSubcategories } = selection;
  const hasSubcategories = availableSubcategories.length > 0;
  const dateField = (
    <FormField htmlFor={`${idPrefix}-date`} label="Date">
      <Input
        ref={localDateInputRef}
        id={`${idPrefix}-date`}
        name="localDate"
        type="date"
        defaultValue={defaultValues.localDate}
        min={dateMin}
        max={dateMax}
        required
      />
    </FormField>
  );
  const typeField = showTypeField ? (
    <FormField htmlFor={`${idPrefix}-type`} label="Type">
      <Select
        id={`${idPrefix}-type`}
        name="type"
        value={selectedType}
        onChange={(event) => {
          setSelectedType(event.target.value as TransactionType);
          setSelectedCategoryId("");
          setSelectedSubcategoryId("");
        }}
      >
        <option value="INCOME">Income</option>
        <option value="EXPENSE">Expense</option>
      </Select>
    </FormField>
  ) : (
    <input type="hidden" name="type" value={selectedType} />
  );
  const amountField = (
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
  );
  const categoryField = (
    <FormField htmlFor={`${idPrefix}-category`} label="Category">
      <Select
        id={`${idPrefix}-category`}
        name="categoryId"
        value={selection.categoryId}
        onChange={(event) => {
          const nextCategoryId = event.target.value;
          const nextCategory = availableCategories.find((category) => category.id === nextCategoryId) ?? null;
          const nextAvailableSubcategories = nextCategory?.subcategories ?? [];

          setSelectedCategoryId(nextCategoryId);
          setSelectedSubcategoryId((currentSubcategoryId) =>
            nextAvailableSubcategories.some((subcategory) => subcategory.id === currentSubcategoryId) ? currentSubcategoryId : "",
          );
        }}
        required
      >
        <option value="">
          {availableCategories.length > 0
            ? "Select category"
            : selectedType === "EXPENSE"
              ? "No expense categories available"
              : "No income categories available"}
        </option>
        {availableCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {formatCategoryLabel(category)}
          </option>
        ))}
      </Select>
    </FormField>
  );

  return (
    <>
      {singleColumn ? (
        <>
          {dateField}
          {typeField}
          {amountField}
          {categoryField}
        </>
      ) : (
        <>
          <div className={cn("grid gap-4 md:grid-cols-2")}>
            {typeField}
            {amountField}
          </div>
          <div className={cn("grid gap-4 md:grid-cols-2")}>
            {dateField}
            {categoryField}
          </div>
        </>
      )}

      <FormField htmlFor={`${idPrefix}-subcategory`} label="Subcategory">
        <Select
          id={`${idPrefix}-subcategory`}
          name="subcategoryId"
          value={selection.subcategoryId}
          onChange={(event) => {
            setSelectedSubcategoryId(event.target.value);
          }}
          disabled={!selection.categoryId || !hasSubcategories}
        >
          <option value="">
            {!selection.categoryId
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
