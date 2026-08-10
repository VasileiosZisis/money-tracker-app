import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BalanceAdjustmentFormFieldsProps = {
  idPrefix: string;
  currency: string;
  latestCompletedMonth: string;
  defaultValues: {
    amount: string;
    effectiveMonth: string;
    note: string;
  };
};

export function BalanceAdjustmentFormFields({
  idPrefix,
  currency,
  latestCompletedMonth,
  defaultValues,
}: BalanceAdjustmentFormFieldsProps) {
  return (
    <FieldGroup className="gap-4 md:grid md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-amount`}>Amount</FieldLabel>
        <CurrencyInput
          id={`${idPrefix}-amount`}
          name="amount"
          currency={currency}
          defaultValue={defaultValues.amount}
          placeholder="0.00"
          autoComplete="off"
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-effective-month`}>
          Effective month
        </FieldLabel>
        <Input
          id={`${idPrefix}-effective-month`}
          name="effectiveMonth"
          type="month"
          max={latestCompletedMonth}
          defaultValue={defaultValues.effectiveMonth}
          className="relative pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2"
          required
        />
      </Field>

      <Field className="md:col-span-2">
        <FieldLabel htmlFor={`${idPrefix}-note`}>Note</FieldLabel>
        <Textarea
          id={`${idPrefix}-note`}
          name="note"
          defaultValue={defaultValues.note}
          placeholder="Opening balance or other context"
          maxLength={500}
        />
        <FieldDescription>
          Optional context, up to 500 characters.
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
