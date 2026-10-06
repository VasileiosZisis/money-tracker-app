export type MoneyPresentation = { money: Record<string, string>; signedMoney: Record<string, string>; signs: Record<string, number>; percentages: Record<string, string> };

export function displayFormatter(display: MoneyPresentation) {
  return { format: (amount: string | number) => display.money[String(amount)] ?? "—" };
}

export function displaySignedMoney(display: MoneyPresentation, amount: string) {
  return display.signedMoney[amount] ?? "—";
}

export function displayChangePercent(display: MoneyPresentation, value: string | null) {
  return value === null ? "—" : display.percentages[value] ?? "—";
}
