"use client";

import { useMemo, useState } from "react";

import { CurrencyInput } from "@/components/ui/currency-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type PlannedBillFormCategory = {
  id: string;
  name: string;
  isArchived: boolean;
  tags: {
    id: string;
    name: string;
  }[];
};

type PlannedBillFormDefaultValues = {
  name: string;
  amount: string;
  categoryId: string;
  tagId: string;
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
}: {
  idPrefix: string;
  currency: string;
  categories: PlannedBillFormCategory[];
  defaultValues: PlannedBillFormDefaultValues;
  includeStatusField: boolean;
  disableCategorySelection?: boolean;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultValues.categoryId);
  const [selectedTagId, setSelectedTagId] = useState(defaultValues.tagId);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const availableTags = useMemo(() => selectedCategory?.tags ?? [], [selectedCategory]);
  const hasTags = availableTags.length > 0;
  const resolvedSelectedTagId = availableTags.some((tag) => tag.id === selectedTagId)
    ? selectedTagId
    : "";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
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

      <div className="grid gap-4 md:grid-cols-2">
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
              const nextAvailableTags = nextCategory?.tags ?? [];

              setSelectedCategoryId(nextCategoryId);
              setSelectedTagId((currentTagId) =>
                nextAvailableTags.some((tag) => tag.id === currentTagId)
                  ? currentTagId
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

        <FormField htmlFor={`${idPrefix}-tag`} label="Tag">
          <Select
            id={`${idPrefix}-tag`}
            name="tagId"
            value={resolvedSelectedTagId}
            onChange={(event) => {
              setSelectedTagId(event.target.value);
            }}
            disabled={!selectedCategoryId || !hasTags}
          >
            <option value="">
              {!selectedCategoryId
                ? "Select category first"
                : hasTags
                  ? "No tag"
                  : "No tags for this category"}
            </option>
            {availableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
