/**
 * Import helpers in this phase build an ephemeral preview/validation pipeline.
 * Preview state should remain temporary and must not be stored long-term in the
 * database.
 */

export type ImportPreviewPersistence = "ephemeral";

export { detectImportColumnMapping, normalizeImportHeader } from "@/lib/import/columns";
export { parseCsvText } from "@/lib/import/csv";
export { buildImportPreview } from "@/lib/import/preview";
export { createImportPreviewToken } from "@/lib/import/token";
export type {
  ImportCategoryOption,
  ImportCategoryResolutionCandidate,
  ImportCategoryResolutionState,
  ImportPreviewResult,
  ImportPreviewRowError,
  ImportPreviewRowResult,
} from "@/lib/import/preview";
