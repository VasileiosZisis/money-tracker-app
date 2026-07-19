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
import { EmptyState } from "@/components/ui/empty-state";
import { PageNotice } from "@/components/ui/page-notice";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";
import { cn } from "@/lib/utils";
import { PlannedBillFormFields } from "./planned-bill-form-fields";

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

function getAvailableExpenseCategories(
  categories: ExpenseCategoryRow[],
  selectedCategoryId?: string,
) {
  return categories.filter(
    (category) => !category.isArchived || category.id === selectedCategoryId,
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
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
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
      subcategoryId: String(formData.get("subcategoryId") ?? ""),
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
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Planning"
        title="Planned Bills"
        description="Track expected monthly expenses separately from actual transactions so your next planning features have a clean, explainable input."
        actions={
          <Link
            href="#planned-bill-form"
            className={cn(buttonVariants(), "rounded-lg")}
          >
            <Plus />
            Add planned bill
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-muted-foreground">Total planned bills</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {plannedBills.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-muted-foreground">Active</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {activeBills.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
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
            monthly expenses used for forecasting. Use a positive amount and a due day
            between 1 and 28.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!hasExpenseCategoryOptions ? (
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
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

          <form action={createPlannedBillAction} className="grid gap-4">
            <PlannedBillFormFields
              idPrefix="create-planned-bill"
              currency={currency}
              categories={creatableExpenseCategories}
              defaultValues={{
                name: "",
                amount: "",
                categoryId: creatableExpenseCategories[0]?.id ?? "",
                subcategoryId: "",
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
          description="Planned bills are expected monthly expenses used for forecasting. Add recurring items like rent, internet, or utilities so the dashboard has clearer upcoming-bill input."
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
        <section className="grid gap-4 xl:grid-cols-2">
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

              <CardContent className="grid gap-4 p-5">
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
                        className="rounded-xl border border-border/80 bg-background/60 p-4"
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
                                {plannedBill.subcategory ? (
                                  <Badge variant="outline">{plannedBill.subcategory.name}</Badge>
                                ) : null}
                                {plannedBill.category.isArchived ? (
                                  <Badge variant="outline">Archived category</Badge>
                                ) : null}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Category
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {plannedBill.category.name}
                                  </p>
                                  {plannedBill.subcategory ? (
                                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                                      {plannedBill.subcategory.name}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Status
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {plannedBill.isActive ? "Included in planning" : "Paused"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-card/70 p-3">
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
                            <form action={updatePlannedBillAction} className="grid gap-4 border-t border-border/70 pt-4">
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
                                  subcategoryId: plannedBill.subcategoryId ?? "",
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
