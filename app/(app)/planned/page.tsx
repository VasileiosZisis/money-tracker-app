import {
  FolderOpen,
  PencilLine,
  Power,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listCategories } from "@/actions/categories";
import {
  createPlannedBill,
  deletePlannedBill,
  listPlannedBills,
  togglePlannedBillActive,
  updatePlannedBill,
} from "@/actions/planned-bills";
import {
  createPlannedIncome,
  deletePlannedIncome,
  listPlannedIncomes,
  togglePlannedIncomeActive,
  updatePlannedIncome,
} from "@/actions/planned-income";
import {
  PlannedItemCreateTabs,
  type PlannedCreateTab,
} from "@/app/(app)/planned/planned-item-create-tabs";
import {
  PlannedItemFiltersDisclosure,
  type PlannedItemStatusFilter,
  type PlannedItemTypeFilter,
} from "@/app/(app)/planned/planned-item-filters-disclosure";
import { PlannedBillFormFields } from "@/app/(app)/planned/planned-bill-form-fields";
import { PlannedIncomeFormFields } from "@/app/(app)/planned-income/planned-income-form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastFeedback } from "@/components/ui/toast-feedback";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";
import { cn } from "@/lib/utils";

type CategoryRow = Awaited<ReturnType<typeof listCategories>>[number];
type PlannedBillRow = Awaited<ReturnType<typeof listPlannedBills>>[number];
type PlannedIncomeRow = Awaited<ReturnType<typeof listPlannedIncomes>>[number];

type PlannedFormCategory = {
  id: string;
  isArchived: boolean;
  name: string;
  subcategories: Array<{
    id: string;
    name: string;
  }>;
};

type PlannedItem =
  | { kind: "BILL"; item: PlannedBillRow }
  | { kind: "INCOME"; item: PlannedIncomeRow };

function normalizeTypeFilter(value: string | undefined): PlannedItemTypeFilter {
  return value === "BILL" || value === "INCOME" ? value : "ALL";
}

function normalizeStatusFilter(
  value: string | undefined,
): PlannedItemStatusFilter {
  return value === "inactive" ? "inactive" : "active";
}

function normalizeCreateTab(value: string | undefined): PlannedCreateTab {
  return value === "INCOME" ? "INCOME" : "BILL";
}

function buildPlannedPageUrl(params: {
  add?: PlannedCreateTab;
  edit?: string;
  error?: string;
  status?: PlannedItemStatusFilter;
  success?: string;
  type?: PlannedItemTypeFilter;
}) {
  return buildPathWithSearchParams("/planned", {
    type: params.type && params.type !== "ALL" ? params.type : undefined,
    status: params.status === "inactive" ? "inactive" : undefined,
    add: params.add === "INCOME" ? "INCOME" : undefined,
    edit: params.edit,
    error: params.error,
    success: params.success,
  });
}

function buildPlannedViewUrl(
  type: PlannedItemTypeFilter,
  status: PlannedItemStatusFilter,
  params: {
    add?: PlannedCreateTab;
    edit?: string;
    error?: string;
    success?: string;
  },
) {
  return buildPlannedPageUrl({ type, status, ...params });
}

function parseBooleanField(value: FormDataEntryValue | null) {
  return String(value ?? "false") === "true";
}

function formatMoney(formatter: Intl.NumberFormat, amount: string) {
  return formatter.format(Number(amount));
}

function toFormCategories(categories: CategoryRow[]): PlannedFormCategory[] {
  return categories.map((category) => ({
    id: category.id,
    isArchived: category.isArchived,
    name: category.name,
    subcategories: category.subcategories.map((subcategory) => ({
      id: subcategory.id,
      name: subcategory.name,
    })),
  }));
}

function getAvailableCategories(
  categories: PlannedFormCategory[],
  selectedCategoryId?: string,
) {
  return categories.filter(
    (category) => !category.isArchived || category.id === selectedCategoryId,
  );
}

export default async function PlannedPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedParams = await resolveSearchParams(searchParams);
  const selectedType = normalizeTypeFilter(
    firstSearchParamValue(resolvedParams.type),
  );
  const selectedStatus = normalizeStatusFilter(
    firstSearchParamValue(resolvedParams.status),
  );
  const initialCreateTab = normalizeCreateTab(
    firstSearchParamValue(resolvedParams.add),
  );
  const editParam = firstSearchParamValue(resolvedParams.edit);
  const errorMessage = firstSearchParamValue(resolvedParams.error);
  const successMessage = firstSearchParamValue(resolvedParams.success);

  async function createPlannedBillAction(formData: FormData) {
    "use server";

    const result = await createPlannedBill({
      name: String(formData.get("name") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
      dueDayOfMonth: String(formData.get("dueDayOfMonth") ?? ""),
      isActive: true,
    });

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          add: "BILL",
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: "Planned bill created.",
      }),
    );
  }

  async function createPlannedIncomeAction(formData: FormData) {
    "use server";

    const result = await createPlannedIncome({
      name: String(formData.get("name") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
      expectedDayOfMonth: String(formData.get("expectedDayOfMonth") ?? ""),
      isActive: true,
    });

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          add: "INCOME",
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: "Planned income created.",
      }),
    );
  }

  async function updatePlannedBillAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const result = await updatePlannedBill({
      id,
      name: String(formData.get("name") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
      dueDayOfMonth: String(formData.get("dueDayOfMonth") ?? ""),
      isActive: parseBooleanField(formData.get("isActive")),
    });

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          edit: `bill:${id}`,
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: "Planned bill updated.",
      }),
    );
  }

  async function updatePlannedIncomeAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const result = await updatePlannedIncome({
      id,
      name: String(formData.get("name") ?? ""),
      source: String(formData.get("source") ?? ""),
      note: String(formData.get("note") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
      expectedDayOfMonth: String(formData.get("expectedDayOfMonth") ?? ""),
      isActive: parseBooleanField(formData.get("isActive")),
    });

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          edit: `income:${id}`,
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: "Planned income updated.",
      }),
    );
  }

  async function togglePlannedBillAction(formData: FormData) {
    "use server";

    const nextIsActive = parseBooleanField(formData.get("nextIsActive"));
    const result = await togglePlannedBillActive({
      id: String(formData.get("id") ?? ""),
      isActive: nextIsActive,
    });

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: nextIsActive
          ? "Planned bill activated."
          : "Planned bill deactivated.",
      }),
    );
  }

  async function togglePlannedIncomeAction(formData: FormData) {
    "use server";

    const nextIsActive = parseBooleanField(formData.get("nextIsActive"));
    const result = await togglePlannedIncomeActive({
      id: String(formData.get("id") ?? ""),
      isActive: nextIsActive,
    });

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: nextIsActive
          ? "Planned income activated."
          : "Planned income deactivated.",
      }),
    );
  }

  async function deletePlannedBillAction(formData: FormData) {
    "use server";

    const result = await deletePlannedBill(String(formData.get("id") ?? ""));

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: "Planned bill deleted.",
      }),
    );
  }

  async function deletePlannedIncomeAction(formData: FormData) {
    "use server";

    const result = await deletePlannedIncome(
      String(formData.get("id") ?? ""),
    );

    if (!result.ok) {
      redirect(
        buildPlannedViewUrl(selectedType, selectedStatus, {
          error: result.error,
        }),
      );
    }

    redirect(
      buildPlannedViewUrl(selectedType, selectedStatus, {
        success: "Planned income deleted.",
      }),
    );
  }

  const userId = await getUserIdOrThrow();
  const [plannedBills, plannedIncomes, categories, user] = await Promise.all([
    listPlannedBills(),
    listPlannedIncomes(),
    listCategories(),
    db.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    }),
  ]);

  const currency = user?.currency ?? "USD";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const expenseCategories = toFormCategories(
    categories.filter((category) => category.type === "EXPENSE"),
  );
  const incomeCategories = toFormCategories(
    categories.filter((category) => category.type === "INCOME"),
  );
  const creatableExpenseCategories = expenseCategories.filter(
    (category) => !category.isArchived,
  );
  const creatableIncomeCategories = incomeCategories.filter(
    (category) => !category.isArchived,
  );
  const showActive = selectedStatus === "active";
  const visibleItems: PlannedItem[] = [
    ...(selectedType === "INCOME"
      ? []
      : plannedBills
          .filter((plannedBill) => plannedBill.isActive === showActive)
          .map((item) => ({ kind: "BILL" as const, item }))),
    ...(selectedType === "BILL"
      ? []
      : plannedIncomes
          .filter((plannedIncome) => plannedIncome.isActive === showActive)
          .map((item) => ({ kind: "INCOME" as const, item }))),
  ];

  return (
    <div className="flex flex-col gap-5">
      <ToastFeedback error={errorMessage} success={successMessage} />

      <section className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Add planned item</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <PlannedItemCreateTabs
                key={initialCreateTab}
                createBillAction={createPlannedBillAction}
                createIncomeAction={createPlannedIncomeAction}
                currency={currency}
                expenseCategories={creatableExpenseCategories}
                incomeCategories={creatableIncomeCategories}
                initialTab={initialCreateTab}
              />
            </CardContent>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <PlannedItemFiltersDisclosure
              key={`${selectedType}:${selectedStatus}`}
              resetHref={buildPlannedPageUrl({ type: selectedType })}
              selectedStatus={selectedStatus}
              selectedType={selectedType}
            />

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/70 pb-4">
                <CardTitle>Planned items list</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-4">
                {visibleItems.length === 0 ? (
                  <EmptyState icon={FolderOpen} title="No planned items" />
                ) : (
                  visibleItems.map((plannedItem) => {
                    if (plannedItem.kind === "BILL") {
                      const plannedBill = plannedItem.item;
                      const editorValue = `bill:${plannedBill.id}`;
                      const isEditing = editParam === editorValue;
                      const editCategories = getAvailableCategories(
                        expenseCategories,
                        plannedBill.categoryId,
                      );

                      return (
                        <div
                          key={editorValue}
                          className="rounded-xl border border-border/80 bg-background/60 p-4"
                        >
                          <div className="space-y-4">
                            <div className="flex min-w-0 items-center justify-between gap-4">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                                  <TrendingDown className="size-4.5" />
                                </div>
                                <div className="flex min-w-0 flex-col">
                                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                    {plannedBill.category.name}
                                  </h3>
                                  {plannedBill.subcategory ? (
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      {plannedBill.subcategory.name}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-end">
                                <p className="text-sm font-medium text-muted-foreground">
                                  Due day {plannedBill.dueDayOfMonth}
                                </p>
                                <p className="font-mono text-base font-semibold tracking-tight text-destructive">
                                  {formatMoney(formatter, plannedBill.amount)}
                                </p>
                              </div>
                            </div>

                            {!isEditing ? (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={buildPlannedViewUrl(
                                    selectedType,
                                    selectedStatus,
                                    { edit: editorValue },
                                  )}
                                  className={cn(
                                    buttonVariants({
                                      variant: "outline",
                                      size: "sm",
                                    }),
                                    "rounded-xl",
                                  )}
                                >
                                  <PencilLine />
                                  View/Edit
                                </Link>
                              </div>
                            ) : null}

                            {isEditing ? (
                              <form
                                action={updatePlannedBillAction}
                                className="grid gap-4 border-t border-border/70 pt-4"
                              >
                                <input
                                  type="hidden"
                                  name="id"
                                  value={plannedBill.id}
                                />
                                <input
                                  type="hidden"
                                  name="isActive"
                                  value={String(plannedBill.isActive)}
                                />

                                <PlannedBillFormFields
                                  idPrefix={`edit-${plannedBill.id}`}
                                  currency={currency}
                                  categories={editCategories}
                                  defaultValues={{
                                    name: plannedBill.name,
                                    source: plannedBill.source ?? "",
                                    note: plannedBill.note ?? "",
                                    amount: plannedBill.amount,
                                    categoryId: plannedBill.categoryId,
                                    subcategoryId:
                                      plannedBill.subcategoryId ?? "",
                                    dueDayOfMonth:
                                      plannedBill.dueDayOfMonth,
                                    isActive: plannedBill.isActive,
                                  }}
                                  includeStatusField={false}
                                />

                                <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
                                  <Link
                                    href={buildPlannedViewUrl(
                                      selectedType,
                                      selectedStatus,
                                      {},
                                    )}
                                    className={cn(
                                      buttonVariants({ variant: "outline" }),
                                      "rounded-xl",
                                    )}
                                  >
                                    Close/Cancel
                                  </Link>
                                  <Button
                                    type="submit"
                                    formAction={deletePlannedBillAction}
                                    formNoValidate
                                    variant="destructive"
                                  >
                                    <Trash2 />
                                    Delete bill
                                  </Button>
                                  <Button
                                    type="submit"
                                    name="nextIsActive"
                                    value={String(!plannedBill.isActive)}
                                    formAction={togglePlannedBillAction}
                                    formNoValidate
                                    variant="outline"
                                    className="rounded-xl"
                                  >
                                    <Power />
                                    {plannedBill.isActive
                                      ? "Deactivate"
                                      : "Activate"}
                                  </Button>
                                  <Button type="submit">Save changes</Button>
                                </div>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      );
                    }

                    const plannedIncome = plannedItem.item;
                    const editorValue = `income:${plannedIncome.id}`;
                    const isEditing = editParam === editorValue;
                    const editCategories = getAvailableCategories(
                      incomeCategories,
                      plannedIncome.categoryId,
                    );

                    return (
                      <div
                        key={editorValue}
                        className="rounded-xl border border-border/80 bg-background/60 p-4"
                      >
                        <div className="space-y-4">
                          <div className="flex min-w-0 items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                                <TrendingUp className="size-4.5" />
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                  {plannedIncome.category.name}
                                </h3>
                                {plannedIncome.subcategory ? (
                                  <p className="text-sm leading-6 text-muted-foreground">
                                    {plannedIncome.subcategory.name}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col items-end">
                              <p className="text-sm font-medium text-muted-foreground">
                                Expected day {plannedIncome.expectedDayOfMonth}
                              </p>
                              <p className="font-mono text-base font-semibold tracking-tight text-success">
                                {formatMoney(formatter, plannedIncome.amount)}
                              </p>
                            </div>
                          </div>

                          {!isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={buildPlannedViewUrl(
                                  selectedType,
                                  selectedStatus,
                                  { edit: editorValue },
                                )}
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  }),
                                  "rounded-xl",
                                )}
                              >
                                <PencilLine />
                                View/Edit
                              </Link>
                            </div>
                          ) : null}

                          {isEditing ? (
                            <form
                              action={updatePlannedIncomeAction}
                              className="grid gap-4 border-t border-border/70 pt-4"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={plannedIncome.id}
                              />
                              <input
                                type="hidden"
                                name="isActive"
                                value={String(plannedIncome.isActive)}
                              />

                              <PlannedIncomeFormFields
                                idPrefix={`edit-${plannedIncome.id}`}
                                currency={currency}
                                categories={editCategories}
                                defaultValues={{
                                  name: plannedIncome.name,
                                  source: plannedIncome.source ?? "",
                                  note: plannedIncome.note ?? "",
                                  amount: plannedIncome.amount,
                                  categoryId: plannedIncome.categoryId,
                                  subcategoryId:
                                    plannedIncome.subcategoryId ?? "",
                                  expectedDayOfMonth:
                                    plannedIncome.expectedDayOfMonth,
                                  isActive: plannedIncome.isActive,
                                }}
                                includeStatusField={false}
                              />

                              <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
                                <Link
                                  href={buildPlannedViewUrl(
                                    selectedType,
                                    selectedStatus,
                                    {},
                                  )}
                                  className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "rounded-xl",
                                  )}
                                >
                                  Close/Cancel
                                </Link>
                                <Button
                                  type="submit"
                                  formAction={deletePlannedIncomeAction}
                                  formNoValidate
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  Delete income
                                </Button>
                                <Button
                                  type="submit"
                                  name="nextIsActive"
                                  value={String(!plannedIncome.isActive)}
                                  formAction={togglePlannedIncomeAction}
                                  formNoValidate
                                  variant="outline"
                                  className="rounded-xl"
                                >
                                  <Power />
                                  {plannedIncome.isActive
                                    ? "Deactivate"
                                    : "Activate"}
                                </Button>
                                <Button type="submit">Save changes</Button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
