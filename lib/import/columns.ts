import {
  importPreviewFieldNames,
  type ImportColumnMapping,
  type ImportPreviewFieldName,
} from "@/lib/validators/import";

export type ImportColumnDescriptor = {
  index: number;
  header: string;
  normalizedHeader: string;
};

const headerAliases: Record<ImportPreviewFieldName, string[]> = {
  localDate: ["localdate", "date", "transactiondate", "entrydate"],
  type: ["type", "transactiontype", "entrytype"],
  category: ["category", "categoryname"],
  amount: ["amount", "value", "sum"],
  source: ["source", "paymentsource", "account", "paymentmethod"],
  note: ["note", "notes", "memo", "description", "details"],
};

export function normalizeImportHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function detectImportColumnMapping(
  headers: string[],
  overrideMapping?: ImportColumnMapping,
) {
  const columns: ImportColumnDescriptor[] = headers.map((header, index) => ({
    index,
    header,
    normalizedHeader: normalizeImportHeader(header),
  }));

  const autoMapping = importPreviewFieldNames.reduce<ImportColumnMapping>((mapping, field) => {
    const match = columns.find((column) =>
      headerAliases[field].includes(column.normalizedHeader),
    );

    if (match) {
      mapping[field] = match.index;
    }

    return mapping;
  }, {});

  const mergedMapping = {
    ...autoMapping,
    ...overrideMapping,
  };

  const sanitizedMapping = importPreviewFieldNames.reduce<ImportColumnMapping>((mapping, field) => {
    const columnIndex = mergedMapping[field];

    if (columnIndex !== undefined && columnIndex >= 0 && columnIndex < columns.length) {
      mapping[field] = columnIndex;
    }

    return mapping;
  }, {});

  return {
    columns,
    mapping: sanitizedMapping,
  };
}
