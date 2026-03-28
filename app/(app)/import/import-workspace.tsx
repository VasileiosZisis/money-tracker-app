"use client";

import { useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  RefreshCcw,
  Rows3,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageNotice } from "@/components/ui/page-notice";
import { Select } from "@/components/ui/select";
import { type ActionResultWithData } from "@/lib/actions/result";
import { importPreviewFieldNames, type ImportColumnMapping } from "@/lib/import/shared";
import {
  type ImportCategoryResolutionState,
  type ImportPreviewResult,
} from "@/lib/import/types";
import { buildPathWithSearchParams } from "@/lib/routes/search-params";
import { cn } from "@/lib/utils";

type ResolutionState = Omit<ImportCategoryResolutionState, "key"> & {
  categoryId: string;
  createName: string;
};

type ImportPreviewActionResult = ActionResultWithData<ImportPreviewResult>;
type ImportConfirmationData = {
  importedCount: number;
  skippedDuplicateCount: number;
  createdCategoryCount: number;
};
type ConfirmImportResult = ActionResultWithData<ImportConfirmationData>;

const fieldLabels: Record<(typeof importPreviewFieldNames)[number], string> = {
  localDate: "Date",
  type: "Type",
  category: "Category",
  amount: "Amount",
  source: "Source",
  note: "Note",
};

function buildDefaultResolutionState(preview: ImportPreviewResult) {
  return preview.categoryResolutions.reduce<Record<string, ResolutionState>>((state, resolution) => {
    state[resolution.key] = {
      action: resolution.action,
      categoryId: resolution.categoryId ?? "",
      createName: resolution.createName ?? "",
    };
    return state;
  }, {});
}

function buildInitialColumnMapping(preview: ImportPreviewResult) {
  return { ...preview.appliedColumnMapping };
}

function countCategoriesToCreate(
  preview: ImportPreviewResult,
  resolutionState: Record<string, ResolutionState>,
) {
  return preview.categoriesToResolve.filter((candidate) => {
    const resolution = resolutionState[candidate.key];
    return (resolution?.action ?? "create") === "create";
  }).length;
}

function getResolutionIssues(
  preview: ImportPreviewResult,
  resolutionState: Record<string, ResolutionState>,
) {
  return preview.categoriesToResolve.flatMap((candidate) => {
    const resolution = resolutionState[candidate.key];

    if (!resolution) {
      return [`Choose how to resolve "${candidate.sourceName}".`];
    }

    if (resolution.action === "map" && resolution.categoryId.trim().length === 0) {
      return [`Select an existing category for "${candidate.sourceName}".`];
    }

    if (resolution.action === "create" && resolution.createName.trim().length === 0) {
      return [`Provide a category name for "${candidate.sourceName}".`];
    }

    return [];
  });
}

function getMostRecentImportedMonth(rows: ImportPreviewResult["rowsForConfirmation"]) {
  const months = rows.map((row) => row.localDate.slice(0, 7)).filter((month) => month.length === 7);

  if (months.length === 0) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  return [...months].sort().at(-1) ?? months[0];
}

function buildImportSuccessMessage(result: ImportConfirmationData) {
  const details = [
    `${result.importedCount} imported`,
    `${result.createdCategoryCount} categories created`,
    `${result.skippedDuplicateCount} duplicates skipped`,
  ];

  return `Import complete: ${details.join(", ")}.`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function requestImportPreview(formData: FormData): Promise<ImportPreviewActionResult> {
  const response = await fetch("/api/import/preview", {
    method: "POST",
    body: formData,
  });

  return parseJsonResponse<ImportPreviewActionResult>(response);
}

async function requestImportConfirmation(payload: {
  previewGeneratedAt: string;
  confirmationToken: string;
  rows: ImportPreviewResult["rowsForConfirmation"];
  categoryResolutions: {
    key: string;
    action: "map" | "create";
    categoryId?: string;
    createName?: string;
  }[];
}): Promise<ConfirmImportResult> {
  const response = await fetch("/api/import/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<ConfirmImportResult>(response);
}

export function ImportWorkspace() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({});
  const [resolutionState, setResolutionState] = useState<Record<string, ResolutionState>>({});
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isConfirmPending, startConfirmTransition] = useTransition();

  const resolutionIssues = preview ? getResolutionIssues(preview, resolutionState) : [];
  const categoriesToCreateCount = preview
    ? countCategoriesToCreate(preview, resolutionState)
    : 0;

  function resetPreviewState() {
    setPreview(null);
    setColumnMapping({});
    setResolutionState({});
  }

  function handlePreview(fileOverride?: File | null) {
    const file = fileOverride ?? selectedFile;

    if (!file) {
      setError("Choose a CSV file to import.");
      return;
    }

    setError("");
    setSuccess("");

    startPreviewTransition(() => {
      void (async () => {
        const formData = new FormData();
        formData.set("file", file);

        if (Object.keys(columnMapping).length > 0) {
          formData.set("columnMapping", JSON.stringify(columnMapping));
        }

        const result = await requestImportPreview(formData);

        if (!result.ok) {
          setPreview(null);
          setError(result.error);
          return;
        }

        setPreview(result.data);
        setColumnMapping(buildInitialColumnMapping(result.data));
        setResolutionState(buildDefaultResolutionState(result.data));
      })();
    });
  }

  function handleFileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileInputRef.current?.files?.[0] ?? null;

    if (!file) {
      setError("Choose a CSV file to import.");
      return;
    }

    setSelectedFile(file);
    handlePreview(file);
  }

  function handleConfirmImport() {
    if (!preview) {
      return;
    }

    if (preview.missingRequiredFields.length > 0) {
      setError("Map the required columns before confirming the import.");
      return;
    }

    if (resolutionIssues.length > 0) {
      setError(resolutionIssues[0]);
      return;
    }

    startConfirmTransition(() => {
      void (async () => {
        const categoryResolutions = preview.categoryResolutions.map((resolution) => {
          const resolvedState = resolutionState[resolution.key] ?? {
            action: resolution.action,
            categoryId: resolution.categoryId ?? "",
            createName: resolution.createName ?? "",
          };

          return resolvedState.action === "map"
            ? {
                key: resolution.key,
                action: "map" as const,
                categoryId: resolvedState.categoryId,
              }
            : {
                key: resolution.key,
                action: "create" as const,
                createName: resolvedState.createName,
              };
        });

        const result = await requestImportConfirmation({
          previewGeneratedAt: preview.previewGeneratedAt,
          confirmationToken: preview.confirmationToken,
          rows: preview.rowsForConfirmation,
          categoryResolutions,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        const successMessage = buildImportSuccessMessage(result.data);
        const targetMonth = getMostRecentImportedMonth(preview.rowsForConfirmation);

        if (result.data.importedCount > 0) {
          router.push(
            buildPathWithSearchParams("/transactions", {
              month: targetMonth,
              success: successMessage,
            }),
          );
          return;
        }

        setSuccess(successMessage);
        setError("");
      })();
    });
  }

  const canConfirm =
    preview !== null &&
    preview.rowsForConfirmation.length > 0 &&
    preview.missingRequiredFields.length === 0 &&
    resolutionIssues.length === 0 &&
    !isPreviewPending &&
    !isConfirmPending;

  return (
    <div className="space-y-6">
      {error ? (
        <PageNotice variant="error" title="Import needs attention">
          {error}
        </PageNotice>
      ) : null}

      {!error && success ? (
        <PageNotice variant="success" title="Import complete">
          {success}
        </PageNotice>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Import is manual and explicit. Upload a CSV, preview the rows, resolve any issues,
              then confirm before anything is written to the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleFileSubmit} className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="import-file">CSV file</Label>
                <Input
                  id="import-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={() => {
                    setError("");
                    setSuccess("");
                    resetPreviewState();
                    setSelectedFile(fileInputRef.current?.files?.[0] ?? null);
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isPreviewPending}>
                  <Upload />
                  {isPreviewPending ? "Building preview..." : "Preview import"}
                </Button>
                {preview ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePreview()}
                    disabled={isPreviewPending}
                  >
                    <RefreshCcw />
                    Refresh preview
                  </Button>
                ) : null}
              </div>
            </form>

            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">Required columns</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                `localDate`, `type`, `category`, and `amount`
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Optional columns: `source`, `note`
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Imported rows become normal transactions after confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">1. Preview</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                The app parses the CSV, detects columns, validates each row, and shows what needs
                to be fixed before import.
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">2. Resolve categories</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Unknown categories can be mapped to an existing one or created during import.
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-muted-foreground">3. Confirm</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Confirmation creates normal transactions. Existing rows are never overwritten.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {!preview ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No import preview yet"
          description="Upload a CSV to review detected columns, row-level validation, and category mapping before anything is written."
        />
      ) : null}

      {preview ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="space-y-1 p-5">
                <p className="text-sm font-medium text-muted-foreground">Total rows</p>
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {preview.summary.totalRows}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-5">
                <p className="text-sm font-medium text-muted-foreground">Valid rows</p>
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {preview.summary.validRows}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-5">
                <p className="text-sm font-medium text-muted-foreground">Invalid rows</p>
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {preview.summary.invalidRows}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-5">
                <p className="text-sm font-medium text-muted-foreground">Categories to create</p>
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {categoriesToCreateCount}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Column mapping</CardTitle>
                <CardDescription>
                  Review the detected mapping and adjust it before refreshing the preview if the
                  CSV headers do not match automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {importPreviewFieldNames.map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`mapping-${field}`}>{fieldLabels[field]}</Label>
                    <Select
                      id={`mapping-${field}`}
                      value={
                        columnMapping[field] === undefined ? "" : String(columnMapping[field])
                      }
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setColumnMapping((current) => ({
                          ...current,
                          [field]: nextValue === "" ? undefined : Number(nextValue),
                        }));
                      }}
                    >
                      <option value="">Not mapped</option>
                      {preview.detectedColumns.map((column) => (
                        <option key={column.index} value={column.index}>
                          {column.header || `Column ${column.index + 1}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}

                <div className="rounded-[24px] border border-border/80 bg-background/60 p-4 sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <Rows3 className="size-[18px] text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Detected columns</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {preview.detectedColumns.map((column) => (
                      <Badge key={column.index} variant="outline" className="rounded-full">
                        {column.header || `Column ${column.index + 1}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                {preview.missingRequiredFields.length > 0 ? (
                  <div className="sm:col-span-2">
                    <PageNotice variant="error" title="Required columns are still missing">
                      {preview.missingRequiredFields.map((field) => fieldLabels[field]).join(", ")}
                    </PageNotice>
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <PageNotice variant="success" title="Column mapping looks good">
                      Refresh the preview after changing any column selection so validation runs
                      against the updated mapping.
                    </PageNotice>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confirm import</CardTitle>
                <CardDescription>
                  Only valid rows are imported. Invalid rows stay out of the database.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Preview file</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{preview.fileName}</p>
                </div>

                <div className="rounded-[24px] border border-border/80 bg-background/60 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Ready to import</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {preview.rowsForConfirmation.length} rows will be submitted after category
                    mappings are resolved.
                  </p>
                </div>

                {preview.missingRequiredFields.length > 0 ? (
                  <PageNotice variant="error" title="Confirm is blocked">
                    Required columns still need to be mapped and previewed again.
                  </PageNotice>
                ) : null}

                {!preview.missingRequiredFields.length && resolutionIssues.length > 0 ? (
                  <PageNotice variant="error" title="Confirm is blocked">
                    {resolutionIssues[0]}
                  </PageNotice>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={!canConfirm}
                  >
                    <CheckCircle2 />
                    {isConfirmPending ? "Importing..." : "Confirm import"}
                  </Button>
                  <Link href="/transactions" className={cn(buttonVariants({ variant: "outline" }))}>
                    View transactions
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          {preview.categoriesToResolve.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Resolve categories</CardTitle>
                <CardDescription>
                  Unknown categories must be mapped to an existing category or created before
                  import can continue.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {preview.categoriesToResolve.map((candidate) => {
                  const resolution = resolutionState[candidate.key] ?? {
                    action: "create" as const,
                    categoryId: "",
                    createName: candidate.sourceName,
                  };
                  const categoryOptions = preview.categoryOptions.filter(
                    (category) => category.type === candidate.type,
                  );

                  return (
                    <div
                      key={candidate.key}
                      className="rounded-[24px] border border-border/80 bg-background/60 p-4"
                    >
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Source category</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-foreground">
                              {candidate.sourceName}
                            </p>
                            <Badge variant="outline">{candidate.type.toLowerCase()}</Badge>
                            <Badge variant="outline">
                              Rows {candidate.rowNumbers.join(", ")}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`resolution-action-${candidate.key}`}>Action</Label>
                          <Select
                            id={`resolution-action-${candidate.key}`}
                            value={resolution.action}
                            onChange={(event) => {
                              const nextAction = event.target.value as "map" | "create";
                              setResolutionState((current) => ({
                                ...current,
                                [candidate.key]: {
                                  ...resolution,
                                  action: nextAction,
                                },
                              }));
                            }}
                          >
                            <option value="create">Create new</option>
                            <option value="map">Map existing</option>
                          </Select>
                        </div>

                        {resolution.action === "map" ? (
                          <div className="space-y-2">
                            <Label htmlFor={`resolution-category-${candidate.key}`}>
                              Existing category
                            </Label>
                            <Select
                              id={`resolution-category-${candidate.key}`}
                              value={resolution.categoryId}
                              onChange={(event) => {
                                setResolutionState((current) => ({
                                  ...current,
                                  [candidate.key]: {
                                    ...resolution,
                                    categoryId: event.target.value,
                                  },
                                }));
                              }}
                            >
                              <option value="">Select category</option>
                              {categoryOptions.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                  {category.isArchived ? " (archived)" : ""}
                                </option>
                              ))}
                            </Select>
                            {resolution.categoryId.trim().length === 0 ? (
                              <p className="text-sm text-destructive">
                                Select a category before confirming.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor={`resolution-create-${candidate.key}`}>New category name</Label>
                            <Input
                              id={`resolution-create-${candidate.key}`}
                              value={resolution.createName}
                              onChange={(event) => {
                                setResolutionState((current) => ({
                                  ...current,
                                  [candidate.key]: {
                                    ...resolution,
                                    createName: event.target.value,
                                  },
                                }));
                              }}
                            />
                            {resolution.createName.trim().length === 0 ? (
                              <p className="text-sm text-destructive">
                                Enter a name before confirming.
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Preview rows</CardTitle>
              <CardDescription>
                Review the parsed rows before confirming the import.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {preview.rows.length === 0 ? (
                <EmptyState
                  icon={FileSpreadsheet}
                  title="No rows in preview"
                  description="Upload a CSV to see the parsed rows here."
                />
              ) : (
                preview.rows.slice(0, 20).map((row) => (
                  <div
                    key={row.rowNumber}
                    className="rounded-[24px] border border-border/80 bg-background/60 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            Row {row.rowNumber}
                          </p>
                          <Badge
                            variant={
                              row.status === "invalid"
                                ? "destructive"
                                : row.status === "ready"
                                  ? "success"
                                  : "outline"
                            }
                          >
                            {row.status === "invalid"
                              ? "Invalid"
                              : row.status === "ready"
                                ? "Ready"
                                : "Needs category"}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {row.normalized.localDate ?? "No date"} / {row.normalized.type ?? "No type"} /{" "}
                          {row.normalized.category ?? "No category"} / {row.normalized.amount ?? "No amount"}
                        </p>
                      </div>
                    </div>

                    {row.errors.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {row.errors.map((issue, index) => (
                          <p key={`${row.rowNumber}-${issue.field}-${index}`} className="text-sm text-destructive">
                            {fieldLabels[issue.field as keyof typeof fieldLabels] ?? issue.field}: {issue.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}

              {preview.rows.length > 20 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Showing the first 20 rows from the preview.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
