import { ZodError } from "zod";

import { TransactionType } from "@/generated/prisma/enums";
import { detectImportColumnMapping } from "@/lib/import/columns";
import { parseCsvText } from "@/lib/import/csv";
import { createImportPreviewToken } from "@/lib/import/token";
import {
  importPreviewFieldNames,
  importPreviewRowSchema,
  importRequiredFieldNames,
  type ImportColumnMapping,
  type ImportPreviewConfirmationRow,
  type ImportPreviewFieldName,
} from "@/lib/validators/import";

export type ImportCategoryOption = {
  id: string;
  name: string;
  type: TransactionType;
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
  type: TransactionType;
  sourceName: string;
  matchingCategoryId: string | null;
  matchingCategoryName: string | null;
  matchingCategoryIsArchived: boolean;
  rowNumbers: number[];
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
  appliedColumnMapping: ImportColumnMapping;
  missingRequiredFields: ImportPreviewFieldName[];
  categoryOptions: ImportCategoryOption[];
  categoriesToResolve: ImportCategoryResolutionCandidate[];
  rows: ImportPreviewRowResult[];
  rowsForConfirmation: ImportPreviewConfirmationRow[];
};

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildCategoryLookupKey(type: TransactionType, categoryName: string) {
  return `${type}:${normalizeCategoryName(categoryName).toLowerCase()}`;
}

function normalizeRawField(field: ImportPreviewFieldName, value: string) {
  if (field === "category") {
    const normalized = normalizeCategoryName(value);
    return normalized.length > 0 ? normalized : null;
  }

  if (field === "type") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "INCOME" || normalized === "EXPENSE") {
      return normalized;
    }

    return value.trim().length > 0 ? normalized : null;
  }

  if (field === "amount") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getColumnValue(values: string[], columnIndex?: number) {
  if (columnIndex === undefined) {
    return "";
  }

  return values[columnIndex] ?? "";
}

function mapZodErrors(error: ZodError): ImportPreviewRowError[] {
  return error.issues.map((issue) => {
    const rawField = issue.path[0];

    if (typeof rawField !== "string") {
      return { field: "row", message: issue.message };
    }

    if (importPreviewFieldNames.includes(rawField as ImportPreviewFieldName)) {
      return {
        field: rawField as ImportPreviewFieldName,
        message: issue.message,
      };
    }

    return { field: "row", message: issue.message };
  });
}

export function buildImportPreview(input: {
  fileName: string;
  csvText: string;
  categories: ImportCategoryOption[];
  columnMapping?: ImportColumnMapping;
}) {
  const parsedCsv = parseCsvText(input.csvText);

  if (parsedCsv.rows.length === 0) {
    throw new Error("CSV must include at least one data row.");
  }

  const { columns, mapping } = detectImportColumnMapping(
    parsedCsv.headers,
    input.columnMapping,
  );

  const missingRequiredFields = importRequiredFieldNames.filter(
    (field) => mapping[field] === undefined,
  );

  const categoryLookup = input.categories.reduce<Map<string, ImportCategoryOption>>(
    (lookup, category) => {
      lookup.set(buildCategoryLookupKey(category.type, category.name), category);
      return lookup;
    },
    new Map(),
  );

  const previewRows: ImportPreviewRowResult[] = [];
  const rowsForConfirmation: ImportPreviewConfirmationRow[] = [];
  const categoriesToResolve = new Map<string, ImportCategoryResolutionCandidate>();

  for (const row of parsedCsv.rows) {
    const raw = importPreviewFieldNames.reduce<Record<ImportPreviewFieldName, string>>(
      (record, field) => {
        record[field] = getColumnValue(row.values, mapping[field]);
        return record;
      },
      {
        localDate: "",
        type: "",
        category: "",
        amount: "",
        source: "",
        note: "",
      },
    );

    const parsedRow = importPreviewRowSchema.safeParse(raw);

    if (!parsedRow.success) {
      previewRows.push({
        rowNumber: row.rowNumber,
        raw,
        normalized: {
          localDate: normalizeRawField("localDate", raw.localDate),
          type: normalizeRawField("type", raw.type),
          category: normalizeRawField("category", raw.category),
          amount: normalizeRawField("amount", raw.amount),
          source: normalizeRawField("source", raw.source),
          note: normalizeRawField("note", raw.note),
        },
        errors: mapZodErrors(parsedRow.error),
        status: "invalid",
        categoryResolutionKey: null,
        resolvedCategoryId: null,
        resolvedCategoryName: null,
        resolvedCategoryIsArchived: false,
      });
      continue;
    }

    const normalizedCategory = normalizeCategoryName(parsedRow.data.category);
    const categoryLookupKey = buildCategoryLookupKey(
      parsedRow.data.type,
      normalizedCategory,
    );
    const matchedCategory = categoryLookup.get(categoryLookupKey) ?? null;
    const needsCategoryResolution = matchedCategory === null;

    rowsForConfirmation.push({
      rowNumber: row.rowNumber,
      localDate: parsedRow.data.localDate,
      type: parsedRow.data.type,
      categoryName: normalizedCategory,
      amount: parsedRow.data.amount.toFixed(2),
      source: parsedRow.data.source,
      note: parsedRow.data.note,
      categoryResolutionKey: needsCategoryResolution ? categoryLookupKey : undefined,
      resolvedCategoryId: matchedCategory?.id,
    });

    if (needsCategoryResolution) {
      const existingCandidate = categoriesToResolve.get(categoryLookupKey);

      if (existingCandidate) {
        existingCandidate.rowNumbers.push(row.rowNumber);
      } else {
        categoriesToResolve.set(categoryLookupKey, {
          key: categoryLookupKey,
          type: parsedRow.data.type,
          sourceName: normalizedCategory,
          matchingCategoryId: null,
          matchingCategoryName: null,
          matchingCategoryIsArchived: false,
          rowNumbers: [row.rowNumber],
        });
      }
    }

    previewRows.push({
      rowNumber: row.rowNumber,
      raw,
      normalized: {
        localDate: parsedRow.data.localDate,
        type: parsedRow.data.type,
        category: normalizedCategory,
        amount: parsedRow.data.amount.toFixed(2),
        source: parsedRow.data.source ?? null,
        note: parsedRow.data.note ?? null,
      },
      errors: [],
      status: needsCategoryResolution ? "needs_category_resolution" : "ready",
      categoryResolutionKey: needsCategoryResolution ? categoryLookupKey : null,
      resolvedCategoryId: matchedCategory?.id ?? null,
      resolvedCategoryName: matchedCategory?.name ?? null,
      resolvedCategoryIsArchived: matchedCategory?.isArchived ?? false,
    });
  }

  const previewGeneratedAt = new Date().toISOString();
  const confirmationToken = createImportPreviewToken({
    previewGeneratedAt,
    rows: rowsForConfirmation,
  });

  return {
    fileName: input.fileName,
    previewGeneratedAt,
    confirmationToken,
    summary: {
      totalRows: previewRows.length,
      validRows: rowsForConfirmation.length,
      invalidRows: previewRows.filter((row) => row.status === "invalid").length,
      readyRows: previewRows.filter((row) => row.status === "ready").length,
      categoriesToResolve: categoriesToResolve.size,
    },
    detectedColumns: columns,
    appliedColumnMapping: mapping,
    missingRequiredFields,
    categoryOptions: [...input.categories].sort((left, right) => {
      if (left.type !== right.type) {
        return left.type.localeCompare(right.type);
      }

      return left.name.localeCompare(right.name);
    }),
    categoriesToResolve: [...categoriesToResolve.values()].sort((left, right) =>
      left.sourceName.localeCompare(right.sourceName),
    ),
    rows: previewRows,
    rowsForConfirmation,
  } satisfies ImportPreviewResult;
}
