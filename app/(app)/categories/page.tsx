import {
  FolderOpen,
  PencilLine,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  archiveCategory,
  createCategory,
  listCategories,
  unarchiveCategory,
  updateCategoryDetails,
} from "@/actions/categories";
import { CategoryCreateFields } from "@/app/(app)/categories/category-create-fields";
import { CategoryEditForm } from "@/app/(app)/categories/category-edit-form";
import {
  CategoryFiltersDisclosure,
  type CategoryStatusFilter,
  type CategoryTypeFilter,
} from "@/app/(app)/categories/category-filters-disclosure";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastFeedback } from "@/components/ui/toast-feedback";
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams,
} from "@/lib/routes/search-params";
import { cn } from "@/lib/utils";

type CategoryType = "INCOME" | "EXPENSE";

function normalizeTypeFilter(value: string | undefined): CategoryTypeFilter {
  return value === "INCOME" || value === "EXPENSE" ? value : "ALL";
}

function normalizeStatusFilter(
  value: string | undefined,
): CategoryStatusFilter {
  return value === "inactive" ? "inactive" : "active";
}

function buildCategoriesPageUrl(params: {
  edit?: string;
  error?: string;
  status?: CategoryStatusFilter;
  success?: string;
  type?: CategoryTypeFilter;
}) {
  return buildPathWithSearchParams("/categories", {
    type: params.type && params.type !== "ALL" ? params.type : undefined,
    status: params.status === "inactive" ? "inactive" : undefined,
    edit: params.edit,
    error: params.error,
    success: params.success,
  });
}

export default async function CategoriesPage({
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
  const editId = firstSearchParamValue(resolvedParams.edit);
  const errorMessage = firstSearchParamValue(resolvedParams.error);
  const successMessage = firstSearchParamValue(resolvedParams.success);

  async function createCategoryAction(formData: FormData) {
    "use server";

    const subcategoryNames = formData
      .getAll("subcategoryNames")
      .map((value) => String(value));
    const result = await createCategory({
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? "") as CategoryType,
      subcategoryNames,
    });

    if (!result.ok) {
      redirect(
        buildCategoriesPageUrl({
          type: selectedType,
          status: selectedStatus,
          error: result.error,
        }),
      );
    }

    const subcategoryCount = subcategoryNames.filter(
      (name) => name.trim().length > 0,
    ).length;
    const message =
      subcategoryCount > 1
        ? "Category and subcategories created."
        : subcategoryCount === 1
          ? "Category and subcategory created."
          : "Category created.";

    redirect(
      buildCategoriesPageUrl({
        type: selectedType,
        status: selectedStatus,
        success: message,
      }),
    );
  }

  async function updateCategoryAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const existingSubcategoryIds = formData
      .getAll("existingSubcategoryIds")
      .map((value) => String(value));
    const existingSubcategoryNames = formData
      .getAll("existingSubcategoryNames")
      .map((value) => String(value));
    const result = await updateCategoryDetails({
      id,
      name: String(formData.get("name") ?? ""),
      existingSubcategories: existingSubcategoryIds.map(
        (subcategoryId, index) => ({
          id: subcategoryId,
          name: existingSubcategoryNames[index] ?? "",
        }),
      ),
      newSubcategoryNames: formData
        .getAll("newSubcategoryNames")
        .map((value) => String(value)),
      deletedSubcategoryIds: formData
        .getAll("deletedSubcategoryIds")
        .map((value) => String(value)),
    });

    if (!result.ok) {
      redirect(
        buildCategoriesPageUrl({
          type: selectedType,
          status: selectedStatus,
          edit: id,
          error: result.error,
        }),
      );
    }

    redirect(
      buildCategoriesPageUrl({
        type: selectedType,
        status: selectedStatus,
        success: "Category updated.",
      }),
    );
  }

  async function archiveCategoryAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const result = await archiveCategory(id);

    if (!result.ok) {
      redirect(
        buildCategoriesPageUrl({
          type: selectedType,
          status: selectedStatus,
          edit: id,
          error: result.error,
        }),
      );
    }

    redirect(
      buildCategoriesPageUrl({
        type: selectedType,
        status: selectedStatus,
        success: "Category archived.",
      }),
    );
  }

  async function restoreCategoryAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const result = await unarchiveCategory(id);

    if (!result.ok) {
      redirect(
        buildCategoriesPageUrl({
          type: selectedType,
          status: selectedStatus,
          edit: id,
          error: result.error,
        }),
      );
    }

    redirect(
      buildCategoriesPageUrl({
        type: selectedType,
        status: selectedStatus,
        success: "Category restored.",
      }),
    );
  }

  const categories = await listCategories();
  const showArchived = selectedStatus === "inactive";
  const visibleCategories = categories.filter(
    (category) =>
      category.isArchived === showArchived &&
      (selectedType === "ALL" || category.type === selectedType),
  );
  const editingCategory =
    visibleCategories.find((category) => category.id === editId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <ToastFeedback error={errorMessage} success={successMessage} />

      <section className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Add category</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form action={createCategoryAction} className="grid gap-4">
                <CategoryCreateFields />

                <div className="flex justify-end border-t border-border/70 pt-5">
                  <Button type="submit">
                    <Plus />
                    Save category
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <CategoryFiltersDisclosure
              key={`${selectedType}:${selectedStatus}`}
              resetHref={buildCategoriesPageUrl({ type: selectedType })}
              selectedStatus={selectedStatus}
              selectedType={selectedType}
            />

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/70 pb-4">
                <CardTitle>Categories list</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-4">
                {visibleCategories.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title="No categories"
                  />
                ) : (
                  visibleCategories.map((category) => {
                    const isEditing = editingCategory?.id === category.id;
                    const subcategoryNames = category.subcategories
                      .map((subcategory) => subcategory.name)
                      .join(" / ");

                    return (
                      <div
                        key={category.id}
                        className="rounded-xl border border-border/80 bg-background/60 p-4"
                      >
                        <div className="space-y-4">
                          <div
                            className={cn(
                              "flex min-w-0 gap-3",
                              subcategoryNames ? "items-start" : "items-center",
                            )}
                          >
                            <div
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                subcategoryNames ? "mt-1" : undefined,
                                category.type === "INCOME"
                                  ? "bg-success/10 text-success"
                                  : "bg-destructive/10 text-destructive",
                              )}
                            >
                              {category.type === "INCOME" ? (
                                <TrendingUp className="size-4.5" />
                              ) : (
                                <TrendingDown className="size-4.5" />
                              )}
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                {category.name}
                              </h3>
                              {subcategoryNames ? (
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {subcategoryNames}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {!isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={buildCategoriesPageUrl({
                                  type: selectedType,
                                  status: selectedStatus,
                                  edit: category.id,
                                })}
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
                            <CategoryEditForm
                              category={{
                                id: category.id,
                                isArchived: category.isArchived,
                                name: category.name,
                                subcategories: category.subcategories.map(
                                  (subcategory) => ({
                                    id: subcategory.id,
                                    name: subcategory.name,
                                  }),
                                ),
                                type: category.type,
                              }}
                              cancelHref={buildCategoriesPageUrl({
                                type: selectedType,
                                status: selectedStatus,
                              })}
                              archiveAction={archiveCategoryAction}
                              restoreAction={restoreCategoryAction}
                              updateAction={updateCategoryAction}
                            />
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
