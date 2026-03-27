import { PageHeader } from "@/components/app-shell/page-header";
import { ImportWorkspace } from "./import-workspace";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Migration"
        title="Import"
        description="Upload a CSV, preview every row, resolve categories, and confirm the import only when the results look correct."
      />

      <ImportWorkspace />
    </div>
  );
}
