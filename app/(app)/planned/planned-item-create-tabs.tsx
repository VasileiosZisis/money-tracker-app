"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { PlannedBillFormFields } from "@/app/(app)/planned/planned-bill-form-fields";
import { PlannedIncomeFormFields } from "@/app/(app)/planned-income/planned-income-form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlannedCreateTab = "BILL" | "INCOME";

type PlannedFormCategory = {
  id: string;
  isArchived: boolean;
  name: string;
  subcategories: Array<{
    id: string;
    name: string;
  }>;
};

type PlannedItemCreateTabsProps = {
  createBillAction: (formData: FormData) => Promise<void>;
  createIncomeAction: (formData: FormData) => Promise<void>;
  currency: string;
  expenseCategories: PlannedFormCategory[];
  incomeCategories: PlannedFormCategory[];
  initialTab: PlannedCreateTab;
};

export function PlannedItemCreateTabs({
  createBillAction,
  createIncomeAction,
  currency,
  expenseCategories,
  incomeCategories,
  initialTab,
}: PlannedItemCreateTabsProps) {
  const [selectedTab, setSelectedTab] =
    React.useState<PlannedCreateTab>(initialTab);
  const isBillSelected = selectedTab === "BILL";
  const selectedCategories = isBillSelected
    ? expenseCategories
    : incomeCategories;
  const hasCategoryOptions = selectedCategories.length > 0;

  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label="Planned item type"
        className="grid grid-cols-2 gap-2"
      >
        <Button
          type="button"
          role="tab"
          id="add-planned-bill-tab"
          aria-controls="add-planned-bill-panel"
          aria-selected={isBillSelected}
          variant={isBillSelected ? "default" : "outline"}
          onClick={() => setSelectedTab("BILL")}
        >
          Add bill
        </Button>
        <Button
          type="button"
          role="tab"
          id="add-planned-income-tab"
          aria-controls="add-planned-income-panel"
          aria-selected={!isBillSelected}
          variant={!isBillSelected ? "default" : "outline"}
          onClick={() => setSelectedTab("INCOME")}
        >
          Add income
        </Button>
      </div>

      {!hasCategoryOptions ? (
        <div className="rounded-xl border border-border/80 bg-background/60 p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            You need at least one active {isBillSelected ? "expense" : "income"}{" "}
            category before you can add{" "}
            {isBillSelected ? "a planned bill" : "planned income"}.
          </p>
          <div className="mt-3">
            <Link
              href="/categories"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "rounded-xl",
              )}
            >
              Create {isBillSelected ? "expense" : "income"} category
            </Link>
          </div>
        </div>
      ) : null}

      {isBillSelected ? (
        <form
          action={createBillAction}
          role="tabpanel"
          id="add-planned-bill-panel"
          aria-labelledby="add-planned-bill-tab"
          className="grid gap-4"
        >
          <PlannedBillFormFields
            idPrefix="create-planned-bill"
            currency={currency}
            categories={expenseCategories}
            defaultValues={{
              name: "",
              source: "",
              note: "",
              amount: "",
              categoryId: "",
              subcategoryId: "",
              dueDayOfMonth: 1,
              isActive: true,
            }}
            includeStatusField={false}
            disableCategorySelection={!hasCategoryOptions}
            singleColumn
          />

          <div className="flex justify-end border-t border-border/70 pt-5">
            <Button type="submit" disabled={!hasCategoryOptions}>
              <Plus />
              Save planned bill
            </Button>
          </div>
        </form>
      ) : (
        <form
          action={createIncomeAction}
          role="tabpanel"
          id="add-planned-income-panel"
          aria-labelledby="add-planned-income-tab"
          className="grid gap-4"
        >
          <PlannedIncomeFormFields
            idPrefix="create-planned-income"
            currency={currency}
            categories={incomeCategories}
            defaultValues={{
              name: "",
              source: "",
              note: "",
              amount: "",
              categoryId: "",
              subcategoryId: "",
              expectedDayOfMonth: 1,
              isActive: true,
            }}
            includeStatusField={false}
            disableCategorySelection={!hasCategoryOptions}
            singleColumn
          />

          <div className="flex justify-end border-t border-border/70 pt-5">
            <Button type="submit" disabled={!hasCategoryOptions}>
              <Plus />
              Save planned income
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
