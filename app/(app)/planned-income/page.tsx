import { FolderOpen, PencilLine, Plus, Power, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listCategories } from "@/actions/categories";
import {
  createPlannedIncome,
  deletePlannedIncome,
  listPlannedIncomes,
  togglePlannedIncomeActive,
  updatePlannedIncome,
} from "@/actions/planned-income";
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
import { PlannedIncomeFormFields } from "./planned-income-form-fields";

type CategoryRow = Awaited<ReturnType<typeof listCategories>>[number];
type IncomeCategoryRow = CategoryRow;

function buildPlannedIncomePageUrl(params: {
  error?: string;
  success?: string;
  edit?: string;
}) {
  return buildPathWithSearchParams("/planned-income", params);
}

function parseBooleanField(value: FormDataEntryValue | null) {
  return String(value ?? "false") === "true";
}

function formatMoney(formatter: Intl.NumberFormat, amount: string) {
  return formatter.format(Number(amount));
}

function getAvailableIncomeCategories(
  categories: IncomeCategoryRow[],
  selectedCategoryId?: string,
) {
  return categories.filter(
    (category) => !category.isArchived || category.id === selectedCategoryId,
  );
}

export default async function PlannedIncomePage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedParams = await resolveSearchParams(searchParams);

  const errorMessage = firstSearchParamValue(resolvedParams.error);
  const successMessage = firstSearchParamValue(resolvedParams.success);
  const editId = firstSearchParamValue(resolvedParams.edit);

  async function createPlannedIncomeAction(formData: FormData) {
    "use server";

    const result = await createPlannedIncome({
      name: String(formData.get("name") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      tagId: String(formData.get("tagId") ?? ""),
      expectedDayOfMonth: String(formData.get("expectedDayOfMonth") ?? ""),
      isActive: parseBooleanField(formData.get("isActive")),
    });

    if (!result.ok) {
      redirect(buildPlannedIncomePageUrl({ error: result.error }));
    }

    redirect(buildPlannedIncomePageUrl({ success: "Planned income created." }));
  }

  async function updatePlannedIncomeAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const result = await updatePlannedIncome({
      id,
      name: String(formData.get("name") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      tagId: String(formData.get("tagId") ?? ""),
      expectedDayOfMonth: String(formData.get("expectedDayOfMonth") ?? ""),
      isActive: parseBooleanField(formData.get("isActive")),
    });

    if (!result.ok) {
      redirect(buildPlannedIncomePageUrl({ error: result.error, edit: id }));
    }

    redirect(buildPlannedIncomePageUrl({ success: "Planned income updated." }));
  }

  async function togglePlannedIncomeAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const nextIsActive = parseBooleanField(formData.get("isActive"));
    const result = await togglePlannedIncomeActive({
      id,
      isActive: nextIsActive,
    });

    if (!result.ok) {
      redirect(buildPlannedIncomePageUrl({ error: result.error }));
    }

    redirect(
      buildPlannedIncomePageUrl({
        success: nextIsActive
          ? "Planned income activated."
          : "Planned income deactivated.",
      }),
    );
  }

  async function deletePlannedIncomeAction(formData: FormData) {
    "use server";

    const result = await deletePlannedIncome(String(formData.get("id") ?? ""));

    if (!result.ok) {
      redirect(buildPlannedIncomePageUrl({ error: result.error }));
    }

    redirect(buildPlannedIncomePageUrl({ success: "Planned income deleted." }));
  }

  const userId = await getUserIdOrThrow();

  const [plannedIncomes, categories, user] = await Promise.all([
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

  const incomeCategories = categories.filter((category) => category.type === "INCOME");
  const creatableIncomeCategories = incomeCategories.filter(
    (category) => !category.isArchived,
  );
  const hasIncomeCategoryOptions = creatableIncomeCategories.length > 0;

  const activeIncomes = plannedIncomes.filter((plannedIncome) => plannedIncome.isActive);
  const inactiveIncomes = plannedIncomes.filter((plannedIncome) => !plannedIncome.isActive);

  const sections = [
    {
      title: "Active planned income",
      description: "Expected monthly income currently included in projection.",
      incomes: activeIncomes,
      emptyTitle: "No active planned income",
      emptyDescription:
        "Create income above or reactivate an inactive one when it should count toward projected month-end net again.",
    },
    {
      title: "Inactive planned income",
      description: "Stored income templates you are not currently using in planning.",
      incomes: inactiveIncomes,
      emptyTitle: "No inactive planned income",
      emptyDescription:
        "Income you pause will stay here until you reactivate it.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Planned Income"
        description="Track expected monthly income separately from actual transactions. Pending planned income improves projected month-end net, but actual totals still come only from transactions."
        actions={
          <Link
            href="#planned-income-form"
            className={cn(buttonVariants(), "rounded-2xl px-4")}
          >
            <Plus />
            Add planned income
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Total planned income</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {plannedIncomes.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Active</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {activeIncomes.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Inactive</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              {inactiveIncomes.length}
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

      <Card id="planned-income-form">
        <CardHeader>
          <CardTitle>Add planned income</CardTitle>
          <CardDescription>
            Planned income stays separate from actual transactions. Use it for
            repeatable monthly income like salary, then mark or link it when
            the income is actually received.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!hasIncomeCategoryOptions ? (
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                You need at least one active income category before you can add planned
                income.
              </p>
              <div className="mt-3">
                <Link
                  href="/categories"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "rounded-xl",
                  )}
                >
                  Create income category
                </Link>
              </div>
            </div>
          ) : null}

          <form action={createPlannedIncomeAction} className="grid gap-5">
            <PlannedIncomeFormFields
              idPrefix="create-planned-income"
              currency={currency}
              categories={creatableIncomeCategories}
              defaultValues={{
                name: "",
                amount: "",
                categoryId: creatableIncomeCategories[0]?.id ?? "",
                tagId: "",
                expectedDayOfMonth: 1,
                isActive: true,
              }}
              includeStatusField
              disableCategorySelection={!hasIncomeCategoryOptions}
            />

            <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
              <Button type="submit" disabled={!hasIncomeCategoryOptions}>
                <Plus />
                Save planned income
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {plannedIncomes.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No planned income yet"
          description="Planned income represents expected monthly income used for projection. Add salary or other repeatable income so the dashboard can show a more realistic month-end net."
          action={
            <Link
              href="#planned-income-form"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
            >
              <Plus />
              Add first planned income
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
                  <Badge variant="outline">{section.incomes.length}</Badge>
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 p-6">
                {section.incomes.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title={section.emptyTitle}
                    description={section.emptyDescription}
                  />
                ) : (
                  section.incomes.map((plannedIncome) => {
                    const isEditing = editId === plannedIncome.id;
                    const editCategories = getAvailableIncomeCategories(
                      incomeCategories,
                      plannedIncome.categoryId,
                    );

                    return (
                      <div
                        key={plannedIncome.id}
                        className="rounded-[24px] border border-border/80 bg-background/60 p-4 sm:p-5"
                      >
                        <div className="space-y-4">
                          <div className="flex flex-col gap-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold tracking-tight text-foreground">
                                  {plannedIncome.name}
                                </h3>
                                <Badge
                                  variant={plannedIncome.isActive ? "success" : "outline"}
                                >
                                  {plannedIncome.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant="outline">
                                  Expected day {plannedIncome.expectedDayOfMonth}
                                </Badge>
                                {plannedIncome.tag ? (
                                  <Badge variant="outline">{plannedIncome.tag.name}</Badge>
                                ) : null}
                                {plannedIncome.category.isArchived ? (
                                  <Badge variant="outline">Archived category</Badge>
                                ) : null}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Category
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {plannedIncome.category.name}
                                  </p>
                                  {plannedIncome.tag ? (
                                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                                      {plannedIncome.tag.name}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Status
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {plannedIncome.isActive ? "Included in projection" : "Paused"}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    Amount
                                  </p>
                                  <p className="mt-2 font-mono text-lg font-semibold tracking-tight text-success">
                                    {formatMoney(formatter, plannedIncome.amount)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={
                                  isEditing
                                    ? "/planned-income"
                                    : buildPlannedIncomePageUrl({ edit: plannedIncome.id })
                                }
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "rounded-xl",
                                )}
                              >
                                <PencilLine />
                                {isEditing ? "Close edit" : "Edit"}
                              </Link>

                              <form action={togglePlannedIncomeAction}>
                                <input type="hidden" name="id" value={plannedIncome.id} />
                                <input
                                  type="hidden"
                                  name="isActive"
                                  value={String(!plannedIncome.isActive)}
                                />
                                <Button type="submit" variant="outline" size="sm" className="rounded-xl">
                                  <Power />
                                  {plannedIncome.isActive ? "Deactivate" : "Activate"}
                                </Button>
                              </form>
                            </div>
                          </div>

                          {isEditing ? (
                            <form action={updatePlannedIncomeAction} className="grid gap-5 border-t border-border/70 pt-5">
                              <input type="hidden" name="id" value={plannedIncome.id} />
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
                                  amount: plannedIncome.amount,
                                  categoryId: plannedIncome.categoryId,
                                  tagId: plannedIncome.tagId ?? "",
                                  expectedDayOfMonth: plannedIncome.expectedDayOfMonth,
                                  isActive: plannedIncome.isActive,
                                }}
                                includeStatusField={false}
                              />

                              <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
                                <Link
                                  href="/planned-income"
                                  className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "rounded-xl",
                                  )}
                                >
                                  Cancel
                                </Link>
                                <Button
                                  type="submit"
                                  formAction={deletePlannedIncomeAction}
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  Delete income
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
