type PlannedTransactionMetadata = {
  source: string | null;
  note: string | null;
};

export function getGeneratedTransactionMetadata(
  plannedItem: PlannedTransactionMetadata,
  occurrenceNote?: string,
): PlannedTransactionMetadata {
  return {
    source: plannedItem.source,
    note: occurrenceNote ?? plannedItem.note,
  };
}
