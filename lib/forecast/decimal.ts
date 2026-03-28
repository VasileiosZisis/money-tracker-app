import { Prisma } from "@/generated/prisma/client";

export const ZERO_DECIMAL = new Prisma.Decimal(0);

export function toDecimal(value: Prisma.Decimal | string | number) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

export function sumDecimals(values: Iterable<Prisma.Decimal>) {
  let total = ZERO_DECIMAL;

  for (const value of values) {
    total = total.plus(value);
  }

  return roundMoney(total);
}
