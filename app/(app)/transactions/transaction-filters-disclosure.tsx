"use client";

import { ListFilter, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TransactionType = "INCOME" | "EXPENSE";
type TypeFilter = "ALL" | TransactionType;

type FilterCategory = {
  id: string;
  name: string;
  type: TransactionType;
  isArchived: boolean;
  subcategories: Array<{
    id: string;
    name: string;
  }>;
};

type TransactionFiltersDisclosureProps = {
  categories: FilterCategory[];
  resetHref: string;
  selectedCategoryId?: string;
  selectedMonth: string;
  selectedSubcategoryId?: string;
  selectedType: TypeFilter;
};

function formatCategoryLabel(category: FilterCategory) {
  return `${category.name}${category.isArchived ? " (archived)" : ""}`;
}

export function TransactionFiltersDisclosure({
  categories,
  resetHref,
  selectedCategoryId,
  selectedMonth,
  selectedSubcategoryId,
  selectedType,
}: TransactionFiltersDisclosureProps) {
  const hasActiveFilters =
    selectedType !== "ALL" ||
    Boolean(selectedCategoryId) ||
    Boolean(selectedSubcategoryId);
  const [isOpen, setIsOpen] = React.useState(hasActiveFilters);
  const [type, setType] = React.useState<TypeFilter>(selectedType);
  const [categoryId, setCategoryId] = React.useState(selectedCategoryId ?? "");
  const [subcategoryId, setSubcategoryId] = React.useState(
    selectedSubcategoryId ?? "",
  );

  const categoryOptions =
    type === "ALL"
      ? categories
      : categories.filter((category) => category.type === type);
  const selectedCategory = categoryOptions.find(
    (category) => category.id === categoryId,
  );
  const subcategoryOptions = selectedCategory
    ? selectedCategory.subcategories.map((subcategory) => ({
        ...subcategory,
        categoryName: null as string | null,
      }))
    : categoryOptions.flatMap((category) =>
        category.subcategories.map((subcategory) => ({
          ...subcategory,
          categoryName: category.name,
        })),
      );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-3" method="get">
          {selectedType !== "ALL" ? (
            <input type="hidden" name="type" value={selectedType} />
          ) : null}
          {selectedCategoryId ? (
            <input type="hidden" name="categoryId" value={selectedCategoryId} />
          ) : null}
          {selectedSubcategoryId ? (
            <input
              type="hidden"
              name="subcategoryId"
              value={selectedSubcategoryId}
            />
          ) : null}

          <Field className="w-fit gap-1.5 *:w-fit">
            <FieldLabel htmlFor="transactions-month" className="sr-only">
              Month
            </FieldLabel>
            <Input
              id="transactions-month"
              type="month"
              name="month"
              defaultValue={selectedMonth}
            />
          </Field>

          <Button type="submit">Apply</Button>
        </form>

        <Button
          type="button"
          variant="outline"
          aria-expanded={isOpen}
          aria-controls="transaction-filter-panel"
          onClick={() => setIsOpen(true)}
        >
          <ListFilter data-icon="inline-start" />
          Filter
        </Button>
      </div>

      {isOpen ? (
        <Card id="transaction-filter-panel">
          <form method="get">
            <input type="hidden" name="month" value={selectedMonth} />

            <CardHeader className="items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X data-icon="inline-start" />
                Close
              </Button>
            </CardHeader>

            <CardContent>
              <FieldGroup className="gap-3 md:grid md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="filter-type">Type</FieldLabel>
                  <Select
                    id="filter-type"
                    name="type"
                    value={type === "ALL" ? "" : type}
                    onChange={(event) => {
                      setType(
                        event.target.value === ""
                          ? "ALL"
                          : (event.target.value as TransactionType),
                      );
                      setCategoryId("");
                      setSubcategoryId("");
                    }}
                  >
                    <option value="">All types</option>
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="filter-category">Category</FieldLabel>
                  <Select
                    id="filter-category"
                    name="categoryId"
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setSubcategoryId("");
                    }}
                  >
                    <option value="">All categories</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {formatCategoryLabel(category)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="filter-subcategory">
                    Subcategory
                  </FieldLabel>
                  <Select
                    id="filter-subcategory"
                    name="subcategoryId"
                    value={subcategoryId}
                    onChange={(event) => setSubcategoryId(event.target.value)}
                  >
                    <option value="">
                      {categoryId
                        ? "All subcategories in category"
                        : "All subcategories"}
                    </option>
                    {subcategoryOptions.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.categoryName
                          ? `${subcategory.categoryName} / ${subcategory.name}`
                          : subcategory.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>

            <CardFooter className="justify-end">
              <Link
                href={resetHref}
                className={buttonVariants({ variant: "outline" })}
              >
                Reset
              </Link>
              <Button type="submit">Apply</Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
