import { FolderOpen, PencilLine, Plus, Power, ScrollText, Trash2 } from "lucide-react";
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
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageNotice } from "@/components/ui/page-notice";
import { Select } from "@/components/ui/select";
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
type ExpenseCategoryRow = CategoryRow;

function buildPlannedPageUrl(params: {
  error?: string;
  success?: string;
  edit?: string;
}) {
  return buildPathWithSearchParams("/planned", params);
}

function parseBooleanField(value: FormDataEntryValue | null) {
  return String(value ?? "false") === "true";
}

function formatMoney(formatter: Intl.NumberFormat, amount: string) {
  return formatter.format(Number(amount));
}

function formatCategoryLabel(category: ExpenseCategoryRow) {
  return `${category.name}${category.isArchived ? " (archived)" : ""}`;
}

function getAvailableExpenseCategories(
  categories: ExpenseCategoryRow[],
  selectedCategoryId?: string,
) {
  return categories.filter(
    (category) => !category.isArchived || category.id === selectedCategoryId,
  );
}

function PlannedBillFormFields({
  idPrefix,
  currency,
  categories,
  defaultValues,
  includeStatusField,
  disableCategorySelection = false,
}: {
  idPrefix: string;
  currency: string;
  categories: ExpenseCategoryRow[];
  defaultValues: {
    name: string;
    amount: string;
    categoryId: string;
    dueDayOfMonth: number | string;
    isActive: boolean;
  };
  includeStatusField: boolean;
  disableCategorySelection?: boolean;
}) {
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
            defaultValue={defaultValues.categoryId}
            disabled={disableCategorySelection}
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
      </div>

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
    </>
  );
}

export default async function PlannedBillsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedParams = await resolveSearchParams(searchParams);

  const errorMessage = firstSearchParamValue(resolvedParams.error);
  const successMessage = firstSearchParamValue(resolvedParams.success);
  const editId = firstSearchParamValue(resolvedParams.edit);

  async function createPlannedBillAction(formData: FormData) {
    "use server";

    const result = await createPlannedBill({
      name: String(formData.get("name") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      dueDayOfMonth: String(formData.get("dueDayOfMonth") ?? ""),
      isActive: parseBooleanField(formData.get("isActive")),
    });

    if (!result.ok) {
      redirect(buildPlannedPageUrl({ error: result.error }));
    }

    redirect(buildPlannedPageUrl({ success: "Planned bill created." }));
  }

  async function updatePlannedBillAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const result = await updatePlannedBill({
      id,
      name: String(formData.get("name") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      dueDayOfMonth: String(formData.get("dueDayOfMonth") ?? ""),
      isActive: parseBooleanField(formData.get("isActive")),
    });

    if (!result.ok) {
      redirect(buildPlannedPageUrl({ error: result.error, edit: id }));
    }

    redirect(buildPlannedPageUrl({ success: "Planned bill updated." }));
  }

  async function togglePlannedBillAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const nextIsActive = parseBooleanField(formData.get("isActive"));
    const result = await togglePlannedBillActive({
      id,
      isActive: nextIsActive,
    });

    if (!result.ok) {
      redirect(buildPlannedPageUrl({ error: result.error }));
    }

    redirect(
      buildPlannedPageUrl({
        success: nextIsActive ? "Planned bill activated." : "Planned bill deactivated.",
      }),
    );
  }

  async function deletePlannedBillAction(formData: FormData) {
    "use server";

    const result = await deletePlannedBill(String(formData.get("id") ?? ""));

    if (!result.ok) {
      redirect(buildPlannedPageUrl({ error: result.error }));
    }

    redirect(buildPlannedPageUrl({ success: "Planned bill deleted." }));
  }

  const userId = await getUserIdOrThrow();

  const [plannedBills, categories, user] = await Promise.all([
    listPlannedBills(),
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

  const expenseCategories = categories.filter((category) => category.type === "EXPENSE");
  const creatableExpenseCategories = expenseCategories.filter(
    (category) => !category.isArchived,
  );
  const hasExpenseCategoryOptions = creatableExpenseCategories.length > 0;

  const activeBills = plannedBills.filter((plannedBill) => plannedBill.isActive);
  const inactiveBills = plannedBills.filter((plannedBill) => !plannedBill.isActive);

  const sections = [
    {
      title: "Active planned bills",
      description: "Expected monthly expenses currently included in planning.",
      bills: activeBills,
      emptyTitle: "No active planned bills",
      emptyDescription:
        "Create a bill above or reactivate an inactive one when it should count toward planning again.",
    },
    {
      title: "Inactive planned bills",
      description: "Stored templates you are not currently using in planning.",
      bills: inactiveBills,
      emptyTitle: "No inactive planned bills",
      emptyDescription:
        "Bills you pause will stay here until you reactivate them.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Planned Bills"
        description="Track expected monthly expenses separately from actual transactions so your next planning features have a clean, explainable input."
        actions={
          <Link
            href="#planned-bill-form"
            className={cn(buttonVariants(), "rounded-2xl px-4")}
          >
            <Plus />
            Add planned bill
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Total planned bills</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {plannedBills.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Active</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {activeBills.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Inactive</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {inactiveBills.length}
            </p>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? (
        <PageNotice variant="error" title="Something needs attention">
          {errorMessage}
        </PageNotice>
      ) : null}

      {!errorMessage && successMessage ? (
        <PageNotice variant="success" title="Saved">
          {successMessage}
        </PageNotice>
      ) : null}

      <Card id="planned-bill-form">
        <CardHeader>
          <CardTitle>Add planned bill</CardTitle>
          <CardDescription>
            Planned bills stay separate from actual transactions and represent expected
            monthly expenses used for forecasting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!hasExpenseCategoryOptions ? (
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                You need at least one active expense category before you can add a planned
                bill.
              </p>
              <div className="mt-3">
                <Link
                  href="/categories"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "rounded-xl",
                  )}
                >
                  Create expense category
                </Link>
              </div>
            </div>
          ) : null}

          <form action={createPlannedBillAction} className="grid gap-5">
            <PlannedBillFormFields
              idPrefix="create-planned-bill"
              currency={currency}
              categories={creatableExpenseCategories}
              defaultValues={{
                name: "",
                amount: "",
                categoryId: creatableExpenseCategories[0]?.id ?? "",
                dueDayOfMonth: 1,
                isActive: true,
              }}
              includeStatusField
              disableCategorySelection={!hasExpenseCategoryOptions}
            />

            <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
              <Button type="submit" disabled={!hasExpenseCategoryOptions}>
                <Plus />
                Save planned bill
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {plannedBills.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No planned bills yet"
          description="Planned bills are expected monthly expenses used for forecasting. Add items like rent, internet, or utilities here before they become real transactions."
          action={
            <Link
              href="#planned-bill-form"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
            >
              <Plus />
              Add first planned bill
            </Link>
          }
        />
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title} className="overflow-hidden">
              <CardHeader className="border-b border-border/70 pb-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{section.bills.length}</Badge>
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 p-6">
                {section.bills.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title={section.emptyTitle}
                    description={section.emptyDescription}
                  />
                ) : (
                  section.bills.map((plannedBill) => {
                    const isEditing = editId === plannedBill.id;
                    const editCategories = getAvailableExpenseCategories(
                      expenseCategories,
                      plannedBill.categoryId,
                    );

                    return (
                      <div
                        key={plannedBill.id}
                        className="rounded-[24px] border border-border/80 bg-background/60 p-4 sm:p-5"
                      >
                        <div className="space-y-4">
                          <div className="flex flex-col gap-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold tracking-tight text-foreground">
                                  {plannedBill.name}
                                </h3>
                                <Badge
                                  variant={plannedBill.isActive ? "success" : "outline"}
                                >
                                  {plannedBill.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant="outline">
                                  Due day {plannedBill.dueDayOfMonth}
                                </Badge>
                                {plannedBill.category.isArchived ? (
                                  <Badge variant="outline">Archived category</Badge>
                                ) : null}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Category
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {plannedBill.category.name}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Status
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {plannedBill.isActive ? "Included in planning" : "Paused"}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Amount
                                  </p>
                                  <p className="mt-2 font-mono text-lg font-semibold tracking-tight text-foreground">
                                    {formatMoney(formatter, plannedBill.amount)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={isEditing ? "/planned" : buildPlannedPageUrl({ edit: plannedBill.id })}
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "rounded-xl",
                                )}
                              >
                                <PencilLine />
                                {isEditing ? "Close edit" : "Edit"}
                              </Link>

                              <form action={togglePlannedBillAction}>
                                <input type="hidden" name="id" value={plannedBill.id} />
                                <input
                                  type="hidden"
                                  name="isActive"
                                  value={String(!plannedBill.isActive)}
                                />
                                <Button type="submit" variant="outline" size="sm" className="rounded-xl">
                                  <Power />
                                  {plannedBill.isActive ? "Deactivate" : "Activate"}
                                </Button>
                              </form>
                            </div>
                          </div>

                          {isEditing ? (
                            <form action={updatePlannedBillAction} className="grid gap-5 border-t border-border/70 pt-5">
                              <input type="hidden" name="id" value={plannedBill.id} />
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
                                  amount: plannedBill.amount,
                                  categoryId: plannedBill.categoryId,
                                  dueDayOfMonth: plannedBill.dueDayOfMonth,
                                  isActive: plannedBill.isActive,
                                }}
                                includeStatusField={false}
                              />

                              <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
                                <Link
                                  href="/planned"
                                  className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "rounded-xl",
                                  )}
                                >
                                  Cancel
                                </Link>
                                <Button
                                  type="submit"
                                  formAction={deletePlannedBillAction}
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  Delete bill
                                </Button>
                                <Button type="submit">
                                  Save changes
                                </Button>
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
          ))}
        </section>
      )}
    </div>
  );
}
