"use server";

import { getUserIdOrThrow } from "@/lib/auth/session";
import {
  confirmImportForUser,
  previewImportForUser,
  type ConfirmImportResult,
  type ImportPreviewActionResult,
} from "@/lib/import/server";
import { type ConfirmImportInput } from "@/lib/validators/import";

export async function previewImport(formData: FormData): Promise<ImportPreviewActionResult> {
  const userId = await getUserIdOrThrow();
  return previewImportForUser(userId, formData);
}

export async function confirmImport(input: ConfirmImportInput): Promise<ConfirmImportResult> {
  const userId = await getUserIdOrThrow();
  return confirmImportForUser(userId, input);
}
