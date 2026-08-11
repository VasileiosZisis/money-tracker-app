"use client";

import { ListRestart, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { BalanceAdjustmentFormFields } from "@/components/dashboard/balance-adjustment-form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type BalanceAdjustmentCreateDisclosureProps = {
  children?: React.ReactNode;
  currency: string;
  month: string;
  latestCompletedMonth: string;
  initialOpen: boolean;
  managementOpen: boolean;
  closeManagementHref: string;
  manageHref: string;
  createAdjustmentAction: (formData: FormData) => Promise<void>;
};

export function BalanceAdjustmentCreateDisclosure({
  children,
  currency,
  month,
  latestCompletedMonth,
  initialOpen,
  managementOpen,
  closeManagementHref,
  manageHref,
  createAdjustmentAction,
}: BalanceAdjustmentCreateDisclosureProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(initialOpen);

  function openAddMoney() {
    setIsOpen(true);

    if (managementOpen) {
      router.replace(closeManagementHref, { scroll: false });
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          aria-expanded={isOpen}
          aria-controls="add-balance-adjustment-form"
          onClick={openAddMoney}
        >
          <Plus data-icon="inline-start" />
          Add money
        </Button>
        <Link
          href={manageHref}
          scroll={false}
          onClick={() => setIsOpen(false)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ListRestart data-icon="inline-start" />
          Manage adjustments
        </Link>
      </div>

      {isOpen ? (
        <>
          <Separator />
          <div
            id="add-balance-adjustment-form"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-base font-semibold text-foreground">
                  Add money
                </h3>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Add an opening balance or previously untracked money. This
                  changes Total Balance without being counted as transaction
                  income.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X data-icon="inline-start" />
                Close
              </Button>
            </div>

            <form action={createAdjustmentAction} className="flex flex-col gap-4">
              <input type="hidden" name="month" value={month} />
              <BalanceAdjustmentFormFields
                idPrefix="create-balance-adjustment"
                currency={currency}
                latestCompletedMonth={latestCompletedMonth}
                defaultValues={{
                  amount: "",
                  effectiveMonth: latestCompletedMonth,
                  note: "",
                }}
              />
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  <Plus data-icon="inline-start" />
                  Save adjustment
                </Button>
              </div>
            </form>
          </div>
        </>
      ) : (
        children
      )}
    </>
  );
}
