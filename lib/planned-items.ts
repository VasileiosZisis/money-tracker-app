type PlannedTransactionMetadata = {
  source: string | null;
  note: string | null;
};

type PlannedItemKind = "bill" | "income";

export function getPlannedItemLifecycleChange(
  kind: PlannedItemKind,
  formData: Pick<FormData, "get">,
) {
  const id = String(formData.get("id") ?? "");
  const currentIsActive = String(formData.get("isActive") ?? "false") === "true";
  const isActive = !currentIsActive;
  const itemLabel = kind === "bill" ? "Planned bill" : "Planned income";

  return {
    input: { id, isActive },
    successMessage: `${itemLabel} ${isActive ? "activated" : "deactivated"}.`,
  };
}

export function getGeneratedTransactionMetadata(
  plannedItem: PlannedTransactionMetadata,
  occurrenceNote?: string,
): PlannedTransactionMetadata {
  return {
    source: plannedItem.source,
    note: occurrenceNote ?? plannedItem.note,
  };
}
