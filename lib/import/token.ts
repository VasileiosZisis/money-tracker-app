import { createHmac } from "node:crypto";

import { type ImportPreviewConfirmationRow } from "@/lib/validators/import";

type PreviewTokenInput = {
  previewGeneratedAt: string;
  rows: ImportPreviewConfirmationRow[];
};

function getTokenSecret() {
  return process.env.NEXTAUTH_SECRET ?? "money-tracker-import-preview";
}

function serializePreviewTokenInput(input: PreviewTokenInput) {
  return JSON.stringify({
    previewGeneratedAt: input.previewGeneratedAt,
    rows: input.rows.map((row) => ({
      rowNumber: row.rowNumber,
      localDate: row.localDate,
      type: row.type,
      categoryName: row.categoryName,
      amount: row.amount,
      source: row.source ?? null,
      note: row.note ?? null,
      categoryResolutionKey: row.categoryResolutionKey ?? null,
      resolvedCategoryId: row.resolvedCategoryId ?? null,
    })),
  });
}

export function createImportPreviewToken(input: PreviewTokenInput) {
  return createHmac("sha256", getTokenSecret())
    .update(serializePreviewTokenInput(input))
    .digest("hex");
}
