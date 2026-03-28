export const importPreviewFieldNames = [
  "localDate",
  "type",
  "category",
  "amount",
  "source",
  "note",
] as const;

export const importRequiredFieldNames = [
  "localDate",
  "type",
  "category",
  "amount",
] as const;

export type ImportPreviewFieldName = (typeof importPreviewFieldNames)[number];
export type ImportRequiredFieldName = (typeof importRequiredFieldNames)[number];
export type ImportColumnMapping = Partial<Record<ImportPreviewFieldName, number>>;
