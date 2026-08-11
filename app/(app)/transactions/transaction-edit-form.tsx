"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";

import {
  TransactionFormFields,
  type TransactionFormCategory,
  type TransactionFormDefaultValues,
} from "@/app/(app)/transactions/transaction-form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineEditorLink } from "@/components/ui/inline-editor";
import { cn } from "@/lib/utils";

type TransactionEditFormProps = {
  cancelHref: string;
  categories: TransactionFormCategory[];
  currency: string;
  defaultValues: TransactionFormDefaultValues;
  deleteAction: (formData: FormData) => Promise<void>;
  id: string;
  updateAction: (formData: FormData) => Promise<void>;
};

const TRACKED_FIELDS: Array<keyof TransactionFormDefaultValues> = [
  "type",
  "amount",
  "localDate",
  "categoryId",
  "subcategoryId",
  "source",
  "note",
];

export function TransactionEditForm({
  cancelHref,
  categories,
  currency,
  defaultValues,
  deleteAction,
  id,
  updateAction,
}: TransactionEditFormProps) {
  const [hasChanges, setHasChanges] = React.useState(false);

  function detectChanges(form: HTMLFormElement) {
    const formData = new FormData(form);
    const nextHasChanges = TRACKED_FIELDS.some(
      (field) => String(formData.get(field) ?? "") !== defaultValues[field],
    );

    setHasChanges(nextHasChanges);
  }

  return (
    <form
      action={updateAction}
      className="grid gap-4 border-t border-border/70 pt-4"
      onInput={(event) => {
        const form = event.currentTarget;
        requestAnimationFrame(() => detectChanges(form));
      }}
    >
      <input type="hidden" name="id" value={id} />
      <TransactionFormFields
        idPrefix={`edit-${id}`}
        categories={categories}
        currency={currency}
        defaultValues={defaultValues}
        showTypeField={false}
      />

      <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
        <InlineEditorLink
          href={cancelHref}
          className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
        >
          Close/Cancel
        </InlineEditorLink>
        <Button
          type="submit"
          formAction={deleteAction}
          variant="destructive"
          className="rounded-xl"
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
        <Button type="submit" className="rounded-xl" disabled={!hasChanges}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
