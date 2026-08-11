"use client";

import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CategoryType = "INCOME" | "EXPENSE";

type EditableSubcategory = {
  id: string;
  name: string;
};

type NewSubcategory = {
  key: number;
  name: string;
};

type CategoryEditFormProps = {
  archiveAction: (formData: FormData) => Promise<void>;
  cancelHref: string;
  category: {
    id: string;
    isArchived: boolean;
    name: string;
    subcategories: EditableSubcategory[];
    type: CategoryType;
  };
  restoreAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
};

export function CategoryEditForm({
  archiveAction,
  cancelHref,
  category,
  restoreAction,
  updateAction,
}: CategoryEditFormProps) {
  const initialSubcategories = category.subcategories;
  const initialSubcategoryNames = React.useMemo(
    () =>
      new Map(
        initialSubcategories.map((subcategory) => [
          subcategory.id,
          subcategory.name,
        ]),
      ),
    [initialSubcategories],
  );
  const nextSubcategoryKey = React.useRef(0);
  const [categoryName, setCategoryName] = React.useState(category.name);
  const [existingSubcategories, setExistingSubcategories] = React.useState(
    initialSubcategories,
  );
  const [newSubcategories, setNewSubcategories] = React.useState<
    NewSubcategory[]
  >([]);

  const retainedSubcategoryIds = new Set(
    existingSubcategories.map((subcategory) => subcategory.id),
  );
  const deletedSubcategoryIds = initialSubcategories
    .filter((subcategory) => !retainedSubcategoryIds.has(subcategory.id))
    .map((subcategory) => subcategory.id);
  const hasExistingSubcategoryChanges = existingSubcategories.some(
    (subcategory) =>
      subcategory.name !== initialSubcategoryNames.get(subcategory.id),
  );
  const hasNewSubcategories = newSubcategories.some(
    (subcategory) => subcategory.name.trim().length > 0,
  );
  const hasChanges =
    categoryName !== category.name ||
    deletedSubcategoryIds.length > 0 ||
    hasExistingSubcategoryChanges ||
    hasNewSubcategories;

  function updateExistingSubcategory(id: string, name: string) {
    setExistingSubcategories((currentSubcategories) =>
      currentSubcategories.map((subcategory) =>
        subcategory.id === id ? { ...subcategory, name } : subcategory,
      ),
    );
  }

  function removeExistingSubcategory(id: string) {
    setExistingSubcategories((currentSubcategories) =>
      currentSubcategories.filter((subcategory) => subcategory.id !== id),
    );
  }

  function addSubcategory() {
    const key = nextSubcategoryKey.current;
    nextSubcategoryKey.current += 1;
    setNewSubcategories((currentSubcategories) => [
      ...currentSubcategories,
      { key, name: "" },
    ]);
  }

  function updateNewSubcategory(key: number, name: string) {
    setNewSubcategories((currentSubcategories) =>
      currentSubcategories.map((subcategory) =>
        subcategory.key === key ? { ...subcategory, name } : subcategory,
      ),
    );
  }

  function removeNewSubcategory(key: number) {
    setNewSubcategories((currentSubcategories) =>
      currentSubcategories.filter((subcategory) => subcategory.key !== key),
    );
  }

  return (
    <form
      action={updateAction}
      className="grid gap-4 border-t border-border/70 pt-4"
    >
      <input type="hidden" name="id" value={category.id} />

      {existingSubcategories.map((subcategory) => (
        <input
          key={`existing-id-${subcategory.id}`}
          type="hidden"
          name="existingSubcategoryIds"
          value={subcategory.id}
        />
      ))}
      {deletedSubcategoryIds.map((id) => (
        <input
          key={`deleted-id-${id}`}
          type="hidden"
          name="deletedSubcategoryIds"
          value={id}
        />
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField htmlFor={`edit-category-type-${category.id}`} label="Type">
          <Select
            id={`edit-category-type-${category.id}`}
            value={category.type}
            disabled
          >
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </Select>
        </FormField>

        <FormField
          htmlFor={`edit-category-name-${category.id}`}
          label="Category"
        >
          <Input
            id={`edit-category-name-${category.id}`}
            type="text"
            name="name"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            required
            maxLength={50}
          />
        </FormField>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/80 bg-card/70 p-4">
        <h4 className="text-sm font-semibold text-foreground">
          Subcategories
        </h4>

        {existingSubcategories.map((subcategory, index) => (
          <FormField
            key={subcategory.id}
            htmlFor={`edit-subcategory-${subcategory.id}`}
            label={`Subcategory ${index + 1}`}
          >
            <div className="flex gap-2">
              <Input
                id={`edit-subcategory-${subcategory.id}`}
                type="text"
                name="existingSubcategoryNames"
                value={subcategory.name}
                onChange={(event) =>
                  updateExistingSubcategory(
                    subcategory.id,
                    event.target.value,
                  )
                }
                required
                maxLength={50}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Remove ${subcategory.name}`}
                onClick={() => removeExistingSubcategory(subcategory.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </FormField>
        ))}

        {newSubcategories.map((subcategory, index) => (
          <FormField
            key={subcategory.key}
            htmlFor={`new-subcategory-${category.id}-${subcategory.key}`}
            label={`New subcategory ${index + 1}`}
          >
            <div className="flex gap-2">
              <Input
                id={`new-subcategory-${category.id}-${subcategory.key}`}
                type="text"
                name="newSubcategoryNames"
                placeholder="Subcategory name"
                value={subcategory.name}
                onChange={(event) =>
                  updateNewSubcategory(subcategory.key, event.target.value)
                }
                maxLength={50}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Remove new subcategory ${index + 1}`}
                onClick={() => removeNewSubcategory(subcategory.key)}
              >
                <Trash2 />
              </Button>
            </div>
          </FormField>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={addSubcategory}
        >
          <Plus />
          Add subcategory
        </Button>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
        <Link
          href={cancelHref}
          scroll={false}
          className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
        >
          Close/Cancel
        </Link>
        {category.isArchived ? (
          <Button
            type="submit"
            formAction={restoreAction}
            formNoValidate
            variant="outline"
            className="rounded-xl"
          >
            <ArchiveRestore data-icon="inline-start" />
            Restore
          </Button>
        ) : (
          <Button
            type="submit"
            formAction={archiveAction}
            formNoValidate
            variant="destructive"
            className="rounded-xl"
          >
            <Archive data-icon="inline-start" />
            Archive
          </Button>
        )}
        <Button type="submit" className="rounded-xl" disabled={!hasChanges}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
