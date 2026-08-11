"use client";

import { History, ListRestart, PencilLine, Plus, Trash2, X } from "lucide-react";

import { BalanceAdjustmentFormFields } from "@/components/dashboard/balance-adjustment-form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InlineEditorLink,
  InlineEditorPanel,
  InlineEditorProvider,
  useInlineEditor,
} from "@/components/ui/inline-editor";
import { PageNotice } from "@/components/ui/page-notice";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type BalanceAdjustmentRow = {
  amount: string;
  effectiveMonth: string;
  editHref: string;
  formattedAmount: string;
  formattedMonth: string;
  id: string;
  note: string | null;
};

type BalanceAdjustmentCreateDisclosureProps = {
  addHref: string;
  adjustments: BalanceAdjustmentRow[];
  closeHref: string;
  createAdjustmentAction: (formData: FormData) => Promise<void>;
  currency: string;
  deleteAdjustmentAction: (formData: FormData) => Promise<void>;
  initialState?: string;
  latestCompletedMonth: string;
  manageHref: string;
  month: string;
  updateAdjustmentAction: (formData: FormData) => Promise<void>;
};

function BalanceAdjustmentDisclosureContent({
  addHref,
  adjustments,
  closeHref,
  createAdjustmentAction,
  currency,
  deleteAdjustmentAction,
  latestCompletedMonth,
  manageHref,
  month,
  updateAdjustmentAction,
}: Omit<BalanceAdjustmentCreateDisclosureProps, "initialState">) {
  const { activeEditorId } = useInlineEditor();
  const isAdding = activeEditorId === "add";
  const isManaging = Boolean(activeEditorId && !isAdding);
  const editingAdjustment = adjustments.find(
    (adjustment) => adjustment.id === activeEditorId,
  );
  const adjustmentNotFound =
    isManaging && activeEditorId !== "manage" && !editingAdjustment;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <InlineEditorLink
          href={addHref}
          editorId="add"
          className={buttonVariants({ size: "sm" })}
        >
          <Plus data-icon="inline-start" />
          Add money
        </InlineEditorLink>
        <InlineEditorLink
          href={manageHref}
          editorId="manage"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ListRestart data-icon="inline-start" />
          Manage adjustments
        </InlineEditorLink>
      </div>

      {isAdding ? (
        <>
          <Separator />
          <div id="add-balance-adjustment-form" className="flex flex-col gap-4">
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
              <InlineEditorLink
                href={closeHref}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <X data-icon="inline-start" />
                Close
              </InlineEditorLink>
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
                <InlineEditorLink
                  href={closeHref}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Cancel
                </InlineEditorLink>
                <Button type="submit">
                  <Plus data-icon="inline-start" />
                  Save adjustment
                </Button>
              </div>
            </form>
          </div>
        </>
      ) : null}

      {isManaging ? (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="text-base font-semibold text-foreground">
                Balance adjustments
              </h3>
              <InlineEditorLink
                href={closeHref}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <X data-icon="inline-start" />
                Close
              </InlineEditorLink>
            </div>

            {adjustmentNotFound ? (
              <PageNotice variant="error" title="Adjustment unavailable">
                Balance adjustment not found.
              </PageNotice>
            ) : null}

            {adjustments.length === 0 ? (
              <EmptyState
                icon={History}
                title="No balance adjustments yet"
                description="Add an opening balance or previously untracked money to include it in completed-month history."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {adjustments.map((adjustment) => (
                  <div
                    key={adjustment.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="font-mono text-lg font-semibold text-foreground">
                          {adjustment.formattedAmount}
                        </p>
                        <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-muted-foreground">
                          {adjustment.note ?? "No note"}
                        </p>
                        <InlineEditorLink
                          href={adjustment.editHref}
                          editorId={adjustment.id}
                          hideWhenActive
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "mt-1 w-fit",
                          )}
                        >
                          <PencilLine data-icon="inline-start" />
                          Edit
                        </InlineEditorLink>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-muted-foreground">
                        {adjustment.formattedMonth}
                      </p>
                    </div>

                    <InlineEditorPanel editorId={adjustment.id}>
                      <>
                        <Separator />
                        <form
                          action={updateAdjustmentAction}
                          className="flex flex-col gap-4"
                        >
                          <input type="hidden" name="month" value={month} />
                          <input type="hidden" name="id" value={adjustment.id} />
                          <BalanceAdjustmentFormFields
                            idPrefix={`edit-balance-adjustment-${adjustment.id}`}
                            currency={currency}
                            latestCompletedMonth={latestCompletedMonth}
                            defaultValues={{
                              amount: adjustment.amount,
                              effectiveMonth: adjustment.effectiveMonth,
                              note: adjustment.note ?? "",
                            }}
                          />
                          <div className="flex flex-wrap justify-end gap-3">
                            <InlineEditorLink
                              href={manageHref}
                              editorId="manage"
                              className={buttonVariants({ variant: "outline" })}
                            >
                              Close/Cancel
                            </InlineEditorLink>
                            <Button
                              type="submit"
                              formAction={deleteAdjustmentAction}
                              variant="destructive"
                            >
                              <Trash2 data-icon="inline-start" />
                              Delete adjustment
                            </Button>
                            <Button type="submit">Save changes</Button>
                          </div>
                        </form>
                      </>
                    </InlineEditorPanel>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

export function BalanceAdjustmentCreateDisclosure(
  props: BalanceAdjustmentCreateDisclosureProps,
) {
  const { initialState, ...contentProps } = props;

  return (
    <InlineEditorProvider
      initialEditorId={initialState}
      queryParam="balanceAdjustment"
    >
      <BalanceAdjustmentDisclosureContent {...contentProps} />
    </InlineEditorProvider>
  );
}
