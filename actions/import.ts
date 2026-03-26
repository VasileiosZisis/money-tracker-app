"use server";

import { revalidatePath } from "next/cache";

import { TransactionType } from "@/generated/prisma/enums";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildImportPreview, createImportPreviewToken } from "@/lib/import";
import {
  confirmImportSchema,
  importColumnMappingSchema,
  type ConfirmImportInput,
  type ImportPreviewConfirmationRow,
} from "@/lib/validators/import";
import { transactionInputSchema } from "@/lib/validators/transaction";

type ImportPreviewActionResult =
  | {
      ok: true;
      data: ReturnType<typeof buildImportPreview>;
    }
  | {
      ok: false;
      error: string;
    };

type ConfirmImportResult =
  | {
      ok: true;
      importedCount: number;
      skippedDuplicateCount: number;
      createdCategoryCount: number;
    }
  | {
      ok: false;
      error: string;
    };

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildCategoryLookupKey(type: TransactionType, categoryName: string) {
  return `${type}:${normalizeCategoryName(categoryName).toLowerCase()}`;
}

function buildDuplicateRowKey(row: {
  type: TransactionType;
  localDate: string;
  amount: { toFixed: (digits: number) => string };
  categoryId: string;
  source?: string | null;
  note?: string | null;
}) {
  return [
    row.type,
    row.localDate,
    row.amount.toFixed(2),
    row.categoryId,
    row.source ?? "",
    row.note ?? "",
  ].join("|");
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function assertCsvFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) {
    throw new Error("Choose a CSV file to import.");
  }

  if (file.size === 0) {
    throw new Error("The selected CSV file is empty.");
  }

  const fileName = file.name.trim();
  const lowerFileName = fileName.toLowerCase();
  const lowerMimeType = file.type.toLowerCase();

  if (
    !lowerFileName.endsWith(".csv") &&
    !lowerMimeType.includes("csv") &&
    !lowerMimeType.includes("comma-separated-values")
  ) {
    throw new Error("Only CSV files are supported right now.");
  }

  return file;
}

function parseColumnMapping(formData: FormData) {
  const rawMapping = formData.get("columnMapping");

  if (rawMapping === null) {
    return undefined;
  }

  if (typeof rawMapping !== "string") {
    throw new Error("Column mapping must be submitted as JSON.");
  }

  if (rawMapping.trim().length === 0) {
    return undefined;
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawMapping);
  } catch {
    throw new Error("Column mapping must be valid JSON.");
  }

  const parsedMapping = importColumnMappingSchema.safeParse(parsedJson);

  if (!parsedMapping.success) {
    throw new Error(parsedMapping.error.issues[0]?.message ?? "Invalid column mapping.");
  }

  return parsedMapping.data;
}

function collectRequiredCategoryResolutions(rows: ImportPreviewConfirmationRow[]) {
  const resolutionMap = new Map<
    string,
    {
      key: string;
      type: TransactionType;
      sourceName: string;
      rowNumbers: number[];
    }
  >();

  for (const row of rows) {
    if (!row.categoryResolutionKey) {
      continue;
    }

    const existing = resolutionMap.get(row.categoryResolutionKey);

    if (existing) {
      existing.rowNumbers.push(row.rowNumber);
      continue;
    }

    resolutionMap.set(row.categoryResolutionKey, {
      key: row.categoryResolutionKey,
      type: row.type,
      sourceName: row.categoryName,
      rowNumbers: [row.rowNumber],
    });
  }

  return resolutionMap;
}

function revalidateImportPaths() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/export");
  revalidatePath("/import");
}

export async function previewImport(formData: FormData): Promise<ImportPreviewActionResult> {
  const userId = await getUserIdOrThrow();

  try {
    const file = assertCsvFile(formData.get("file"));
    const columnMapping = parseColumnMapping(formData);
    const categories = await db.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        isArchived: true,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    const csvText = await file.text();
    const preview = buildImportPreview({
      fileName: file.name,
      csvText,
      categories,
      columnMapping,
    });

    return {
      ok: true,
      data: preview,
    };
  } catch (error) {
    return {
      ok: false,
      error: getActionErrorMessage(error, "Could not parse the CSV file."),
    };
  }
}

export async function confirmImport(input: ConfirmImportInput): Promise<ConfirmImportResult> {
  const userId = await getUserIdOrThrow();
  const parsed = confirmImportSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid import confirmation payload.",
    };
  }

  const expectedToken = createImportPreviewToken({
    previewGeneratedAt: parsed.data.previewGeneratedAt,
    rows: parsed.data.rows,
  });

  if (expectedToken !== parsed.data.confirmationToken) {
    return {
      ok: false,
      error: "Import preview is out of date. Re-upload the CSV and confirm again.",
    };
  }

  const previewStartedAt = new Date(parsed.data.previewGeneratedAt);

  if (Number.isNaN(previewStartedAt.getTime())) {
    return {
      ok: false,
      error: "Import preview timestamp is invalid.",
    };
  }

  const requiredResolutions = collectRequiredCategoryResolutions(parsed.data.rows);
  const providedResolutionMap = new Map(
    parsed.data.categoryResolutions.map((resolution) => [resolution.key, resolution]),
  );

  if (providedResolutionMap.size !== parsed.data.categoryResolutions.length) {
    return {
      ok: false,
      error: "Import confirmation includes duplicate category mappings.",
    };
  }

  for (const requiredResolution of requiredResolutions.values()) {
    if (!providedResolutionMap.has(requiredResolution.key)) {
      return {
        ok: false,
        error: `Category mapping is still required for "${requiredResolution.sourceName}".`,
      };
    }
  }

  for (const providedResolution of parsed.data.categoryResolutions) {
    if (!requiredResolutions.has(providedResolution.key)) {
      return {
        ok: false,
        error: "Import confirmation includes an unexpected category mapping.",
      };
    }
  }

  try {
    const result = await db.$transaction(async (transaction) => {
      const categories = await transaction.category.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          isArchived: true,
        },
      });

      const categoriesById = new Map(categories.map((category) => [category.id, category]));
      const categoriesByLookupKey = new Map(
        categories.map((category) => [buildCategoryLookupKey(category.type, category.name), category]),
      );

      const resolvedCategoryIds = new Map<string, string>();
      let createdCategoryCount = 0;

      for (const requiredResolution of requiredResolutions.values()) {
        const resolution = providedResolutionMap.get(requiredResolution.key);

        if (!resolution) {
          throw new Error(`Category mapping is still required for "${requiredResolution.sourceName}".`);
        }

        if (resolution.action === "map") {
          const category = categoriesById.get(resolution.categoryId!);

          if (!category) {
            throw new Error("Selected category could not be found.");
          }

          if (category.type !== requiredResolution.type) {
            throw new Error(
              `Category "${category.name}" does not match ${requiredResolution.type.toLowerCase()} rows.`,
            );
          }

          resolvedCategoryIds.set(requiredResolution.key, category.id);
          continue;
        }

        const categoryName = resolution.createName ?? requiredResolution.sourceName;
        const lookupKey = buildCategoryLookupKey(requiredResolution.type, categoryName);
        const existingCategory = categoriesByLookupKey.get(lookupKey);

        if (existingCategory) {
          resolvedCategoryIds.set(requiredResolution.key, existingCategory.id);
          continue;
        }

        const createdCategory = await transaction.category.create({
          data: {
            userId,
            name: categoryName,
            type: requiredResolution.type,
          },
          select: {
            id: true,
            name: true,
            type: true,
            isArchived: true,
          },
        });

        createdCategoryCount += 1;
        categoriesById.set(createdCategory.id, createdCategory);
        categoriesByLookupKey.set(
          buildCategoryLookupKey(createdCategory.type, createdCategory.name),
          createdCategory,
        );
        resolvedCategoryIds.set(requiredResolution.key, createdCategory.id);
      }

      const validatedRows = parsed.data.rows.map((row) => {
        const categoryId =
          row.resolvedCategoryId ??
          (row.categoryResolutionKey ? resolvedCategoryIds.get(row.categoryResolutionKey) : undefined);

        if (!categoryId) {
          throw new Error(`Row ${row.rowNumber} is missing a category mapping.`);
        }

        const category = categoriesById.get(categoryId);

        if (!category) {
          throw new Error(`Row ${row.rowNumber} references a category that is no longer available.`);
        }

        if (category.type !== row.type) {
          throw new Error(`Row ${row.rowNumber} category type does not match the transaction type.`);
        }

        const transactionInput = transactionInputSchema.safeParse({
          type: row.type,
          amount: row.amount,
          localDate: row.localDate,
          categoryId,
          source: row.source,
          note: row.note,
        });

        if (!transactionInput.success) {
          throw new Error(
            transactionInput.error.issues[0]?.message ?? `Row ${row.rowNumber} is invalid.`,
          );
        }

        return {
          rowNumber: row.rowNumber,
          type: transactionInput.data.type,
          amount: transactionInput.data.amount,
          localDate: transactionInput.data.localDate,
          categoryId: transactionInput.data.categoryId,
          source: transactionInput.data.source,
          note: transactionInput.data.note,
        };
      });

      const importedLocalDates = [...new Set(validatedRows.map((row) => row.localDate))];
      const recentRows =
        importedLocalDates.length === 0
          ? []
          : await transaction.transaction.findMany({
              where: {
                userId,
                createdAt: {
                  gte: previewStartedAt,
                },
                localDate: {
                  in: importedLocalDates,
                },
              },
              select: {
                type: true,
                amount: true,
                localDate: true,
                categoryId: true,
                source: true,
                note: true,
              },
            });

      const payloadKeys = new Set(validatedRows.map((row) => buildDuplicateRowKey(row)));
      const existingDuplicateCounts = recentRows.reduce<Map<string, number>>((counts, row) => {
        const duplicateKey = buildDuplicateRowKey(row);

        if (!payloadKeys.has(duplicateKey)) {
          return counts;
        }

        counts.set(duplicateKey, (counts.get(duplicateKey) ?? 0) + 1);
        return counts;
      }, new Map());

      const createData = [];
      let skippedDuplicateCount = 0;

      for (const row of validatedRows) {
        const duplicateKey = buildDuplicateRowKey(row);
        const existingCount = existingDuplicateCounts.get(duplicateKey) ?? 0;

        if (existingCount > 0) {
          existingDuplicateCounts.set(duplicateKey, existingCount - 1);
          skippedDuplicateCount += 1;
          continue;
        }

        createData.push({
          userId,
          type: row.type,
          amount: row.amount,
          localDate: row.localDate,
          categoryId: row.categoryId,
          source: row.source ?? null,
          note: row.note ?? null,
        });
      }

      if (createData.length > 0) {
        await transaction.transaction.createMany({
          data: createData,
        });
      }

      return {
        importedCount: createData.length,
        skippedDuplicateCount,
        createdCategoryCount,
      };
    });

    revalidateImportPaths();

    return {
      ok: true,
      importedCount: result.importedCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
      createdCategoryCount: result.createdCategoryCount,
    };
  } catch (error) {
    return {
      ok: false,
      error: getActionErrorMessage(error, "Could not finish the import."),
    };
  }
}
