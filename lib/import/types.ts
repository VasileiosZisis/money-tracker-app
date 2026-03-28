export type ImportTransactionType = "INCOME" | "EXPENSE";

export type ImportPreviewFieldName =
  | "localDate"
  | "type"
  | "category"
  | "amount"
  | "source"
  | "note";

export type ImportCategoryOption = {
  id: string;
  name: string;
  type: ImportTransactionType;
  isArchived: boolean;
};

export type ImportPreviewRowError = {
  field: ImportPreviewFieldName | "row";
  message: string;
};

export type ImportPreviewRowResult = {
  rowNumber: number;
  raw: Record<ImportPreviewFieldName, string>;
  normalized: {
    localDate: string | null;
    type: string | null;
    category: string | null;
    amount: string | null;
    source: string | null;
    note: string | null;
  };
  errors: ImportPreviewRowError[];
  status: "invalid" | "ready" | "needs_category_resolution";
  categoryResolutionKey: string | null;
  resolvedCategoryId: string | null;
  resolvedCategoryName: string | null;
  resolvedCategoryIsArchived: boolean;
};

export type ImportCategoryResolutionCandidate = {
  key: string;
  type: ImportTransactionType;
  sourceName: string;
  matchingCategoryId: string | null;
  matchingCategoryName: string | null;
  matchingCategoryIsArchived: boolean;
  rowNumbers: number[];
};

export type ImportPreviewConfirmationRow = {
  rowNumber: number;
  localDate: string;
  type: ImportTransactionType;
  categoryName: string;
  amount: string;
  source?: string;
  note?: string;
  categoryResolutionKey?: string;
  resolvedCategoryId?: string;
};

export type ImportPreviewResult = {
  fileName: string;
  previewGeneratedAt: string;
  confirmationToken: string;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    readyRows: number;
    categoriesToResolve: number;
  };
  detectedColumns: Array<{
    index: number;
    header: string;
    normalizedHeader: string;
  }>;
  appliedColumnMapping: Partial<Record<ImportPreviewFieldName, number>>;
  missingRequiredFields: ImportPreviewFieldName[];
  categoryOptions: ImportCategoryOption[];
  categoriesToResolve: ImportCategoryResolutionCandidate[];
  rows: ImportPreviewRowResult[];
  rowsForConfirmation: ImportPreviewConfirmationRow[];
};
