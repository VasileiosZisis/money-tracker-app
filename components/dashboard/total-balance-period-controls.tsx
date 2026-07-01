"use client";

import * as React from "react";

import type { DashboardBalanceQueryParams } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type {
  BalancePeriodMode,
  BalanceRangePreset,
} from "@/lib/validators/balance-adjustment";

type TotalBalancePeriodControlsProps = {
  month: string;
  query: DashboardBalanceQueryParams;
  latestCompletedMonth: string;
};

const RANGE_OPTIONS: Array<{ value: BalanceRangePreset; label: string }> = [
  { value: "current-year", label: "Current year" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "last-6-months", label: "Last 6 months" },
  { value: "last-9-months", label: "Last 9 months" },
  { value: "last-12-months", label: "Last 12 months" },
  { value: "previous-1-year", label: "Previous 1 full year" },
  { value: "previous-2-years", label: "Previous 2 full years" },
  { value: "previous-3-years", label: "Previous 3 full years" },
  { value: "all-time", label: "All time" },
  { value: "custom", label: "Custom" },
];

function getDefaultCompletedYear(latestCompletedMonth: string) {
  const year = Number(latestCompletedMonth.slice(0, 4));
  const month = latestCompletedMonth.slice(5, 7);

  return String(month === "12" ? year : year - 1).padStart(4, "0");
}

export function TotalBalancePeriodControls({
  month,
  query,
  latestCompletedMonth,
}: TotalBalancePeriodControlsProps) {
  const [range, setRange] = React.useState<BalanceRangePreset>(
    query.balanceRange,
  );
  const [mode, setMode] = React.useState<BalancePeriodMode>(
    query.balanceMode ?? "months",
  );
  const defaultCompletedYear = getDefaultCompletedYear(latestCompletedMonth);
  const monthStart =
    query.balanceRange === "custom" && query.balanceMode === "months"
      ? query.balanceStart
      : latestCompletedMonth;
  const monthEnd =
    query.balanceRange === "custom" && query.balanceMode === "months"
      ? query.balanceEnd
      : latestCompletedMonth;
  const yearStart =
    query.balanceRange === "custom" && query.balanceMode === "years"
      ? query.balanceStart
      : defaultCompletedYear;
  const yearEnd =
    query.balanceRange === "custom" && query.balanceMode === "years"
      ? query.balanceEnd
      : defaultCompletedYear;

  return (
    <form method="get">
      <input type="hidden" name="month" value={month} />
      <FieldGroup className="gap-4 lg:grid lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)_auto] lg:items-end">
        <Field>
          <FieldLabel htmlFor="balanceRange">Period</FieldLabel>
          <Select
            id="balanceRange"
            name="balanceRange"
            value={range}
            onChange={(event) =>
              setRange(event.target.value as BalanceRangePreset)
            }
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        {range === "custom" ? (
          <FieldGroup className="gap-4 md:grid md:grid-cols-[auto_1fr] md:items-end">
            <Field>
              <FieldTitle id="balanceModeLabel">Custom period</FieldTitle>
              <input type="hidden" name="balanceMode" value={mode} />
              <ToggleGroup
                aria-labelledby="balanceModeLabel"
                value={[mode]}
                variant="outline"
                size="lg"
                spacing={2}
                onValueChange={(values) => {
                  const nextMode = values[0] as BalancePeriodMode | undefined;

                  if (nextMode) {
                    setMode(nextMode);
                  }
                }}
              >
                <ToggleGroupItem value="months">Months</ToggleGroupItem>
                <ToggleGroupItem value="years">Years</ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="balanceStart">Start</FieldLabel>
                <Input
                  key={`start-${mode}`}
                  id="balanceStart"
                  name="balanceStart"
                  type={mode === "months" ? "month" : "number"}
                  min={mode === "years" ? "1000" : undefined}
                  max={
                    mode === "months"
                      ? latestCompletedMonth
                      : defaultCompletedYear
                  }
                  defaultValue={mode === "months" ? monthStart : yearStart}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="balanceEnd">End</FieldLabel>
                <Input
                  key={`end-${mode}`}
                  id="balanceEnd"
                  name="balanceEnd"
                  type={mode === "months" ? "month" : "number"}
                  min={mode === "years" ? "1000" : undefined}
                  max={
                    mode === "months"
                      ? latestCompletedMonth
                      : defaultCompletedYear
                  }
                  defaultValue={mode === "months" ? monthEnd : yearEnd}
                  required
                />
              </Field>
            </FieldGroup>
          </FieldGroup>
        ) : (
          <div className="hidden lg:block" />
        )}

        <Button type="submit" size="lg">
          Apply period
        </Button>
      </FieldGroup>
    </form>
  );
}
