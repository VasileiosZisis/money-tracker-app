"use client";

import { ListFilter, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

type PlannedItemType = "BILL" | "INCOME";
export type PlannedItemTypeFilter = "ALL" | PlannedItemType;
export type PlannedItemStatusFilter = "active" | "inactive";

type PlannedItemFiltersDisclosureProps = {
  resetHref: string;
  selectedStatus: PlannedItemStatusFilter;
  selectedType: PlannedItemTypeFilter;
};

export function PlannedItemFiltersDisclosure({
  resetHref,
  selectedStatus,
  selectedType,
}: PlannedItemFiltersDisclosureProps) {
  const [isOpen, setIsOpen] = React.useState(selectedStatus === "inactive");
  const [type, setType] =
    React.useState<PlannedItemTypeFilter>(selectedType);
  const [status, setStatus] =
    React.useState<PlannedItemStatusFilter>(selectedStatus);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-3" method="get">
          {type !== "ALL" ? (
            <input type="hidden" name="type" value={type} />
          ) : null}
          {selectedStatus === "inactive" ? (
            <input type="hidden" name="status" value="inactive" />
          ) : null}

          <Field className="w-fit gap-1.5 *:w-fit">
            <FieldLabel htmlFor="planned-item-type" className="sr-only">
              Type
            </FieldLabel>
            <Select
              id="planned-item-type"
              value={type === "ALL" ? "" : type}
              onChange={(event) =>
                setType(
                  event.target.value === ""
                    ? "ALL"
                    : (event.target.value as PlannedItemType),
                )
              }
            >
              <option value="">All</option>
              <option value="BILL">Bill</option>
              <option value="INCOME">Income</option>
            </Select>
          </Field>

          <Button type="submit">Apply</Button>
        </form>

        <Button
          type="button"
          variant="outline"
          aria-expanded={isOpen}
          aria-controls="planned-item-filter-panel"
          onClick={() => setIsOpen(true)}
        >
          <ListFilter data-icon="inline-start" />
          Filter
        </Button>
      </div>

      {isOpen ? (
        <Card id="planned-item-filter-panel">
          <form method="get">
            {selectedType !== "ALL" ? (
              <input type="hidden" name="type" value={selectedType} />
            ) : null}
            {status === "inactive" ? (
              <input type="hidden" name="status" value="inactive" />
            ) : null}

            <CardHeader className="items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X data-icon="inline-start" />
                Close
              </Button>
            </CardHeader>

            <CardContent>
              <Field className="max-w-sm">
                <FieldLabel htmlFor="planned-item-status">Status</FieldLabel>
                <Select
                  id="planned-item-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as PlannedItemStatusFilter)
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </CardContent>

            <CardFooter className="justify-end">
              <Link
                href={resetHref}
                className={buttonVariants({ variant: "outline" })}
              >
                Reset
              </Link>
              <Button type="submit">Apply</Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

