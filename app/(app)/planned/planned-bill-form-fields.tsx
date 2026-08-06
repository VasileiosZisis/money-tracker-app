"use client";

import { useMemo, useState } from "react";

import { CurrencyInput } from "@/components/ui/currency-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PlannedBillFormCategory = {
  id: string;
  name: string;
  isArchived: boolean;
  subcategories: {
    id: string;
    name: string;
  }[];
};

type PlannedBillFormDefaultValues = {
  name: string;
  source: string;
  note: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  dueDayOfMonth: number | string;
  isActive: boolean;
};

function formatCategoryLabel(category: PlannedBillFormCategory) {
  return `${category.name}${category.isArchived ? " (archived)" : ""}`;
}

export function PlannedBillFormFields({
  idPrefix,
  currency,
  categories,
  defaultValues,
  includeStatusField,
  disableCategorySelection = false,
  singleColumn = false,
}: {
  idPrefix: string;
  currency: string;
  categories: PlannedBillFormCategory[];
  defaultValues: PlannedBillFormDefaultValues;
  includeStatusField: boolean;
  disableCategorySelection?: boolean;
  singleColumn?: boolean;
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
      <div className={cn("grid gap-4", !singleColumn && "md:grid-cols-2")}>
        <FormField htmlFor={`${idPrefix}-name`} label="Name">
          <Input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            defaultValue={defaultValues.name}
            placeholder="Rent, utilities, internet..."
            maxLength={120}
            required
          />
        </FormField>

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

      <div className={cn("grid gap-4", !singleColumn && "md:grid-cols-2")}>
        <FormField htmlFor={`${idPrefix}-category`} label="Expense category">
          <Select
            id={`${idPrefix}-category`}
            name="categoryId"
            value={selectedCategoryId}
            disabled={disableCategorySelection}
            onChange={(event) => {
              const nextCategoryId = event.target.value;
              const nextCategory =
                categories.find((category) => category.id === nextCategoryId) ?? null;
              const nextAvailableSubcategories = nextCategory?.subcategories ?? [];

              setSelectedCategoryId(nextCategoryId);
              setSelectedSubcategoryId((currentSubcategoryId) =>
                nextAvailableSubcategories.some((subcategory) => subcategory.id === currentSubcategoryId)
                  ? currentSubcategoryId
                  : "",
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
      </div>

      <div className={cn("grid gap-4", !singleColumn && "md:grid-cols-2")}>
        <FormField htmlFor={`${idPrefix}-source`} label="Source">
          <Input
            id={`${idPrefix}-source`}
            name="source"
            type="text"
            defaultValue={defaultValues.source}
            placeholder="Bank transfer, card, direct debit..."
            maxLength={120}
          />
        </FormField>

        <FormField htmlFor={`${idPrefix}-note`} label="Note">
          <Textarea
            id={`${idPrefix}-note`}
            name="note"
            defaultValue={defaultValues.note}
            placeholder="Optional context for generated transactions"
            maxLength={500}
            rows={4}
          />
        </FormField>
      </div>

      <div className={cn("grid gap-4", !singleColumn && "md:grid-cols-2")}>
        <FormField htmlFor={`${idPrefix}-due-day`} label="Due day of month">
          <Input
            id={`${idPrefix}-due-day`}
            name="dueDayOfMonth"
            type="number"
            min={1}
            max={28}
            defaultValue={defaultValues.dueDayOfMonth}
            required
          />
        </FormField>

        {includeStatusField ? (
          <FormField htmlFor={`${idPrefix}-status`} label="Active status">
            <Select
              id={`${idPrefix}-status`}
              name="isActive"
              defaultValue={String(defaultValues.isActive)}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FormField>
        ) : null}
      </div>
    </>
  );
}
